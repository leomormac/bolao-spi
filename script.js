const URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbxZnCdjfcPn7OC9S9f20IMu5jjA6EQPYAtlHRUtRqzFxoHSX02wgFweA9IWAUjtNplk/exec";

let bancoJogos = [];
let bancoPalpites = [];
let carrinho = [];
const VALOR_APOSTA = 5.00;

// Na função mudarAba, adicione o gatilho para carregar as estatísticas:
function mudarAba(abaId) {
    document.querySelectorAll('.aba-conteudo, .tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`aba-${abaId}`).classList.add('active');
    
    // Adiciona classe active no botão clicado
    const botoes = document.querySelectorAll('.tab-btn');
    botoes.forEach(btn => {
        if(btn.innerText.toLowerCase().includes(abaId.substring(0,3))) btn.classList.add('active');
    });

    if (abaId === 'ganhadores') carregarResultados();
    if (abaId === 'estatisticas') calcularEstatisticas();
}
function formatarDataCurta(dataStr) {
    if (!dataStr) return "Data não informada";
    const dataObj = new Date(dataStr);
    if (!isNaN(dataObj.getTime())) {
        const dia = String(dataObj.getDate()).padStart(2, '0');
        const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
        const ano = dataObj.getFullYear();
        return `${dia}/${mes}/${ano}`;
    }
    return dataStr;
}

async function carregarJogosDaPlanilha() {
    const dataSelect = document.getElementById('dataSelect');
    dataSelect.innerHTML = "<option>Carregando...</option>";
    try {
        const resposta = await fetch(URL_APPS_SCRIPT);
        let dadosBrutos = await resposta.json();
        bancoJogos = dadosBrutos.map(jogo => ({
            ...jogo,
            data: formatarDataCurta(jogo.data) 
        }));
        let datasUnicas = [...new Set(bancoJogos.map(j => j.data))];
        datasUnicas.sort((a, b) => {
            const pA = a.split('/');
            const pB = b.split('/');
            return new Date(pA[2], pA[1]-1, pA[0]) - new Date(pB[2], pB[1]-1, pB[0]);
        });
        const options = datasUnicas.map(d => `<option value="${d}">${d}</option>`).join('');
        dataSelect.innerHTML = options;
        document.getElementById('dataFiltroGanhadores').innerHTML = options;
        filtrarJogosPorData(); 
    } catch (error) {
        dataSelect.innerHTML = "<option>Erro ao carregar</option>";
    }
}

function filtrarJogosPorData() {
    const dataEscolhida = document.getElementById('dataSelect').value;
    const jogosDoDia = bancoJogos.filter(j => j.data === dataEscolhida);
    preencherSelects('jogoSelect', jogosDoDia);
    if(jogosDoDia.length > 0) {
        atualizarInterface(jogosDoDia[0].id);
    } else {
        document.getElementById('jogoSelect').innerHTML = "<option>Sem jogos nesta data</option>";
    }
}

function filtrarJogosGanhadores() {
    const dataEscolhida = document.getElementById('dataFiltroGanhadores').value;
    const jogosDoDia = bancoJogos.filter(j => j.data === dataEscolhida);
    preencherSelects('filtroResultados', jogosDoDia);
    calcularGanhadores();
}

function preencherSelects(selectId, jogos) {
    const select = document.getElementById(selectId);
    select.innerHTML = "";
    jogos.forEach(jogo => {
        let option = document.createElement('option');
        option.value = jogo.id;
        option.text = `${jogo.timeA} x ${jogo.timeB}`;
        select.appendChild(option);
    });
}

function atualizarInterface(jogoId) {
    const jogo = bancoJogos.find(j => j.id.toString().trim() == jogoId.toString().trim());
    if (!jogo) return;

    document.getElementById('nameA').innerText = jogo.timeA;
    document.getElementById('nameB').innerText = jogo.timeB;
    document.getElementById('horarioJogoDisplay').innerText = "Horário: " + (jogo.hora || "Não definido");
    
    const siglaA = jogo.siglaA ? jogo.siglaA.toString().trim().toLowerCase() : "xx";
    const siglaB = jogo.siglaB ? jogo.siglaB.toString().trim().toLowerCase() : "xx";
    document.getElementById('flagA').src = `https://flagcdn.com/w160/${siglaA}.png`;
    document.getElementById('flagB').src = `https://flagcdn.com/w160/${siglaB}.png`;

    const valor = parseFloat(jogo.acumulado) || 0;
    // Em vez de apenas mudar o texto, chamamos a animação:
    animarValor('premioAcumulado', valor);

    // TRAVA DE HORÁRIO NO BOTÃO
    const btnSubmit = document.querySelector('#palpiteForm .btn-submit');
    const jaIniciou = verificarJogoIniciado(jogo.data, jogo.hora);

    if (jaIniciou) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i class="bi bi-bag-x-fill"></i> JOGO INICIADO - ENCERRADO`;
        btnSubmit.style.background = "linear-gradient(180deg, #ff0000 0%, #ff9100 100%)";
        btnSubmit.style.boxShadow = "none";
        btnSubmit.style.cursor = "not-allowed";
    } else {
        btnSubmit.disabled = false;
        btnSubmit.innerText = "+ Adicionar Palpite (R$ 5,00)";
        btnSubmit.style.background = "linear-gradient(180deg, #009c3b 0%, #00732b 100%)";
        btnSubmit.style.boxShadow = "0 8px 0 #b39b00, 0 15px 20px rgba(0,0,0,0.4)";
        btnSubmit.style.cursor = "pointer";
    }
}

document.getElementById('palpiteForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const jogoId = document.getElementById('jogoSelect').value;
    const jogo = bancoJogos.find(j => j.id.toString().trim() == jogoId.toString().trim());
    
    if (!jogo) return alert("Selecione um jogo válido!");

    // VALIDAÇÃO DE HORÁRIO COM ALERTA (Mantida por segurança)
    if (verificarJogoIniciado(jogo.data, jogo.hora)) {
        alert("⚠️ ATENÇÃO: Este jogo já começou! Não é mais possível palpitar nesta partida.");
        atualizarInterface(jogoId);
        return;
    }

    const palpiteA = document.getElementById('palpiteA').value;
    const palpiteB = document.getElementById('palpiteB').value;

    carrinho.push({
        jogoId: jogoId,
        timeA: jogo.timeA, siglaA: jogo.siglaA,
        timeB: jogo.timeB, siglaB: jogo.siglaB,
        palpiteA: palpiteA, palpiteB: palpiteB
    });

    // Zera os inputs para o próximo palpite
    document.getElementById('palpiteA').value = "0";
    document.getElementById('palpiteB').value = "0";
    
    renderizarCarrinho();
    mostrarTendencias();
    // O alerta de sucesso foi removido daqui para deixar o processo mais rápido.
});

function renderizarCarrinho() {
    const area = document.getElementById('carrinhoArea');
    const lista = document.getElementById('listaCarrinho');
    let total = 0;
    if (carrinho.length === 0) {
        area.style.display = 'none';
        return;
    }
    area.style.display = 'block';
    lista.innerHTML = carrinho.map((item, index) => {
        total += VALOR_APOSTA;
        return `
            <div class="cart-item">
                <div class="cart-item-times">
                    <img src="https://flagcdn.com/w40/${item.siglaA.toLowerCase()}.png">
                    <span>${item.timeA}</span>
                    <span class="cart-item-placar">${item.palpiteA} x ${item.palpiteB}</span>
                    <span>${item.timeB}</span>
                    <img src="https://flagcdn.com/w40/${item.siglaB.toLowerCase()}.png">
                </div>
                <button class="cart-btn-remover" onclick="removerDoCarrinho(${index})">X</button>
            </div>
        `;
    }).join('');
    document.getElementById('totalCarrinho').innerText = `Total a pagar: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
}

function removerDoCarrinho(index) {
    carrinho.splice(index, 1);
    renderizarCarrinho();
}

function irParaPagamento() {
    document.getElementById('palpiteForm').style.display = 'none';
    document.getElementById('carrinhoArea').style.display = 'none';
    document.getElementById('pagamentoForm').style.display = 'block';
    const elementoTotal = document.getElementById('totalCarrinho');
    if (elementoTotal) {
        const texto = elementoTotal.innerText; 
        const apenasNumeros = texto.split('R$')[1]?.trim() || "0,00"; 
        document.getElementById('valorDisplayPagamento').innerText = "R$ " + apenasNumeros;
    }
}

function voltarParaPalpites() {
    document.getElementById('pagamentoForm').style.display = 'none';
    document.getElementById('palpiteForm').style.display = 'block';
    renderizarCarrinho();
}

document.getElementById('pagamentoForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const nome = document.getElementById('nome').value.trim();
    const whatsapp = document.getElementById('whatsapp').value.trim();
    const file = document.getElementById('comprovante').files[0];
    if (carrinho.length === 0) return alert("Carrinho vazio!");
    const btn = document.getElementById('btnSubmitPagamento');
    btn.innerText = "Enviando..."; btn.disabled = true;
    const reader = new FileReader();
    reader.onload = async function() {
        const base64String = reader.result.split(',')[1]; 
        try {
            const resposta = await fetch(URL_APPS_SCRIPT, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'enviar_palpite',
                    nome: nome, whatsapp: whatsapp,
                    carrinho: carrinho.map(i => ({ jogoId: i.jogoId, palpiteA: i.palpiteA, palpiteB: i.palpiteB, modalidade: 'Simples' })),
                    arquivoBase64: base64String, mimeType: file.type, nomeArquivo: file.name
                })
            });
            const resultado = await resposta.json();
            if (resultado.sucesso) {
                document.getElementById('pagamentoForm').style.display = 'none';
                document.getElementById('sucessoSection').style.display = 'block';
                carrinho = [];
            } else { alert("Erro: " + resultado.error); btn.disabled = false; btn.innerText = "CONCLUIR PALPITES"; }
        } catch (error) { alert("Erro ao enviar imagem... Envie Novamente."); btn.disabled = false; btn.innerText = "CONCLUIR PALPITES"; }
    };
    reader.readAsDataURL(file);
});

async function carregarResultados() {
    document.getElementById('listaGanhadores').innerHTML = "<p class='no-results'>Buscando...</p>";
    try {
        const resposta = await fetch(URL_APPS_SCRIPT + "?acao=resultados");
        const dados = await resposta.json();
        bancoPalpites = dados.palpites; 
        // Atualiza os dados reais dos jogos no banco local
        dados.jogos.forEach(jogoNovo => {
            const index = bancoJogos.findIndex(j => j.id.toString() == jogoNovo.id.toString());
            if (index !== -1) {
                bancoJogos[index].placarRealA = jogoNovo.placarRealA;
                bancoJogos[index].placarRealB = jogoNovo.placarRealB;
            }
        });
        filtrarJogosGanhadores(); 
    } catch (e) { document.getElementById('listaGanhadores').innerHTML = "<p class='no-results'>Erro</p>"; }
}

function calcularGanhadores() {
    const jogoIdSelecionado = document.getElementById('filtroResultados').value;
    const jogo = bancoJogos.find(j => j.id.toString().trim() == jogoIdSelecionado.toString().trim());
    const areaPlacar = document.getElementById('placarRealArea');
    const listaHtml = document.getElementById('listaGanhadores');
    
    if (!jogo) return;

    const siglaA = jogo.siglaA ? jogo.siglaA.toString().trim().toLowerCase() : "xx";
    const siglaB = jogo.siglaB ? jogo.siglaB.toString().trim().toLowerCase() : "xx";
    const placarRealA = jogo.placarRealA;
    const placarRealB = jogo.placarRealB;

    areaPlacar.innerHTML = `
        <div class="match-area" style="background: rgba(0,0,0,0.7); border: 2px solid var(--amarelo-cbf);">
            <div class="team">
                <img src="https://flagcdn.com/w160/${siglaA}.png" style="width:50px; height:50px;">
                <span style="font-size:12px;">${jogo.timeA}</span>
            </div>
            <div style="font-size:30px; font-weight:900; color:var(--amarelo-cbf);">${placarRealA !== null ? placarRealA : "?"}</div>
            <div class="versus">X</div>
            <div style="font-size:30px; font-weight:900; color:var(--amarelo-cbf);">${placarRealB !== null ? placarRealB : "?"}</div>
            <div class="team">
                <img src="https://flagcdn.com/w160/${siglaB}.png" style="width:50px; height:50px;">
                <span style="font-size:12px;">${jogo.timeB}</span>
            </div>
        </div>
    `;

    if (placarRealA === null || placarRealB === null) {
        listaHtml.innerHTML = `<p class="no-results">Aguardando resultado oficial da partida...</p>`; 
        return;
    }

    // Filtra os acertadores
    const acertadores = bancoPalpites.filter(p => {
        const mesmoJogo = p.jogoId.toString().trim() == jogo.id.toString().trim();
        const placarACorreto = parseInt(p.palpiteA) === parseInt(placarRealA);
        const placarBCorreto = parseInt(p.palpiteB) === parseInt(placarRealB);
        return mesmoJogo && placarACorreto && placarBCorreto;
    });
    
    if (acertadores.length === 0) {
        listaHtml.innerHTML = `<div class="winner-card"><span class="winner-name"><i class="bi bi-exclamation-circle"></i> Ninguém acertou este placar!</span></div>`; 
        return;
    }
    
    // CÁLCULO DA DIVISÃO DO PRÊMIO
    const premioTotal = parseFloat(jogo.acumulado) || 0;
    const premioIndividual = premioTotal / acertadores.length; // Divide o total pelo número de ganhadores

    listaHtml.innerHTML = acertadores.map(g => `
    <div class="winner-card">
        <span class="winner-name"><i class="bi bi-trophy-fill" style="color: #ffdd00;"></i> ${g.nome}</span>
        <span class="winner-prize">${premioIndividual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
    </div>
`).join('');
}

function copiarChavePix() {
    const chave = document.getElementById('chavePixText').innerText;
    navigator.clipboard.writeText(chave).then(() => {
        const btn = document.querySelector('.btn-copy');
        btn.innerText = "COPIADO!";
        btn.style.background = "var(--verde-neon)";
        setTimeout(() => {
            btn.innerText = "COPIAR";
            btn.style.background = "var(--verde-cbf)";
        }, 2000);
    });
}

function verificarJogoIniciado(dataJogo, horaJogo) {
    if (!dataJogo || !horaJogo) return false;

    try {
        // 1. Limpa e organiza a data da planilha (DD/MM/YYYY)
        const partesData = dataJogo.trim().split('/');
        if (partesData.length !== 3) return false;
        
        const dia = partesData[0].padStart(2, '0');
        const mes = partesData[1].padStart(2, '0');
        const ano = partesData[2];

        // 2. Limpa e organiza a hora da planilha (HH:MM)
        // Se a hora vier como "16:00:00", pegamos apenas "16:00"
        const horaLimpa = horaJogo.trim().substring(0, 5);
        
        // 3. Monta a data do jogo no formato padrão ISO (YYYY-MM-DDTHH:MM:00)
        // Usamos o caractere "T" para separar data e hora, o que é o padrão mais seguro
        const stringDataJogo = `${ano}-${mes}-${dia}T${horaLimpa}:00`;
        const dataObjetoJogo = new Date(stringDataJogo);
        
        // 4. Pega o momento exato de AGORA
        const agora = new Date();

        // LOG DE DEPURAÇÃO (Aparece no F12 do navegador para conferência)
        console.log("--- Verificação de Horário ---");
        console.log("Jogo cadastrado para:", stringDataJogo);
        console.log("Momento atual:", agora.toString());
        console.log("Já iniciou?", agora > dataObjetoJogo);

        // 5. Retorna verdadeiro se o AGORA for maior (depois) que a hora do Jogo
        return agora.getTime() > dataObjetoJogo.getTime();
        
    } catch (e) {
        console.error("Erro crítico na verificação de horário:", e);
        return false;
    }
}


function atualizarNomeArquivo(input) {
    const display = document.getElementById('file-name-display');
    if (input.files && input.files.length > 0) {
        display.innerText = "✅ " + input.files[0].name;
        display.style.color = "var(--verde-neon)";
    } else {
        display.innerText = "Tirar Foto ou Anexar";
        display.style.color = "#fff";
    }
}

// FUNÇÃO PARA ANIMAR OS NÚMEROS
function animarValor(id, valorFinal) {
    const elemento = document.getElementById(id);
    let valorAtual = 0;
    const duracao = 1000; // 1 segundo de animação
    const incremento = valorFinal / (duracao / 16); // ~60 frames por segundo

    const timer = setInterval(() => {
        valorAtual += incremento;
        if (valorAtual >= valorFinal) {
            valorAtual = valorFinal;
            clearInterval(timer);
        }
        elemento.innerText = valorAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }, 16);
}


function formatarNome(input) {
    // 1. Converte tudo para MAIÚSCULAS
    let valor = input.value.toUpperCase();
    
    // 2. Remove números e caracteres especiais (permite apenas letras e espaços)
    // Se quiser permitir números, basta remover a linha abaixo
    valor = valor.replace(/[^A-ZÀ-Ÿ\s]/g, "");
    
    // 3. Devolve o valor limpo para o campo
    input.value = valor;
}

// NOVA FUNÇÃO PARA CALCULAR ESTATÍSTICAS
function calcularEstatisticas() {
    const listaHtml = document.getElementById('listaEstatisticas');
    listaHtml.innerHTML = "<p class='no-results'>Analisando dados...</p>";

    // 1. Filtra apenas os jogos que já têm resultado preenchido
    const jogosFinalizados = bancoJogos.filter(j => j.placarRealA !== null && j.placarRealB !== null);

    if (jogosFinalizados.length === 0) {
        listaHtml.innerHTML = "<p class='no-results'>Nenhum jogo finalizado ainda.</p>";
        return;
    }

    // 2. Conta a frequência de cada placar
    const frequencia = {};
    jogosFinalizados.forEach(j => {
        const placar = `${j.placarRealA} x ${j.placarRealB}`;
        frequencia[placar] = (frequencia[placar] || 0) + 1;
    });

    // 3. Transforma em array e ordena do mais frequente para o menos frequente
    const ordenado = Object.entries(frequencia).sort((a, b) => b[1] - a[1]);

    // 4. Renderiza na tela
    listaHtml.innerHTML = ordenado.map(([placar, qtd]) => `
        <div class="stat-card">
            <div class="stat-placar">${placar}</div>
            <div class="stat-info">
                <span class="stat-qtd">${qtd} ${qtd === 1 ? 'vez' : 'vezes'}</span>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width: ${(qtd / jogosFinalizados.length * 100)}%"></div>
                </div>
            </div>
        </div>
    `).join('');
}

async function carregarTodosOsPalpitesParaTendencias() {
    try {
        const resposta = await fetch(URL_APPS_SCRIPT + "?acao=resultados");
        const dados = await resposta.json();
        bancoPalpites = dados.palpites; // Armazena todos os palpites aprovados
        mostrarTendencias(); // Atualiza a tela
    } catch (e) { console.error("Erro ao carregar tendências"); }
}

// NOVA FUNÇÃO PARA MOSTRAR TENDÊNCIAS DO JOGO SELECIONADO
function mostrarTendencias() {
    const jogoId = document.getElementById('jogoSelect').value;
    const area = document.getElementById('tendenciasArea');
    const lista = document.getElementById('listaTendencias');
    
    // Filtra palpites apenas para este jogo
    const palpitesDesteJogo = bancoPalpites.filter(p => p.jogoId.toString().trim() == jogoId.toString().trim());
    
    if (palpitesDesteJogo.length === 0) {
        area.style.display = 'none';
        return;
    }

    area.style.display = 'block';

    // Conta a frequência
    const contagem = {};
    palpitesDesteJogo.forEach(p => {
        const placar = `${p.palpiteA}x${p.palpiteB}`;
        contagem[placar] = (contagem[placar] || 0) + 1;
    });

    // Ordena e pega os 3 mais votados
    const top3 = Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    lista.innerHTML = top3.map(([placar, qtd]) => `
        <div class="tendencia-item">
            <span class="tendencia-placar">${placar}</span>
            <span class="tendencia-qtd">${qtd} ${qtd === 1 ? 'voto' : 'votos'}</span>
        </div>
    `).join('');
}

function abrirModalPlacares() {
    const jogoId = document.getElementById('jogoSelect').value;
    const corpo = document.getElementById('corpoModalPlacares');
    const modal = document.getElementById('modalPlacares');

    const palpitesDesteJogo = bancoPalpites.filter(p => p.jogoId.toString().trim() == jogoId.toString().trim());
    
    const contagem = {};
    palpitesDesteJogo.forEach(p => {
        const placar = `${p.palpiteA} x ${p.palpiteB}`;
        contagem[placar] = (contagem[placar] || 0) + 1;
    });

    const ordenado = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

    corpo.innerHTML = ordenado.map(([placar, qtd]) => `
        <div class="stat-card" style="margin-bottom: 8px; padding: 10px;">
            <span style="color: var(--amarelo-cbf); font-weight: 900; font-size: 18px;">${placar}</span>
            <span style="color: #fff; font-size: 14px; margin-left: auto;">${qtd} ${qtd === 1 ? 'aposta' : 'apostas'}</span>
        </div>
    `).join('');

    modal.style.display = "block";
}

function fecharModalPlacares() {
    document.getElementById('modalPlacares').style.display = "none";
}

// Fechar o modal se clicar fora dele
window.onclick = function(event) {
    const modal = document.getElementById('modalPlacares');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

carregarJogosDaPlanilha();
carregarTodosOsPalpitesParaTendencias();