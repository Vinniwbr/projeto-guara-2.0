// Aba de configuracoes do user
const botaoExplore = document.querySelector('.explore__rodape--button');
const abaConfiguracoes = document.querySelector('.configuracoes');
const abaPrincipal = document.querySelector('.universal')

botaoExplore.addEventListener('click', function() {
    // Checa se o display atual é 'flex' (aba aberta)
    if (abaConfiguracoes.style.display === 'flex') {
        // Se já estiver aberta, fecha ela
        abaConfiguracoes.style.display = 'none';
        abaPrincipal.style.width = '100%';

    } else {
        // Se estiver fechada, abre ela
        abaConfiguracoes.style.display = 'flex';
        abaConfiguracoes.style.flexDirection = 'column';
        abaPrincipal.style.width = '60%';
}});
