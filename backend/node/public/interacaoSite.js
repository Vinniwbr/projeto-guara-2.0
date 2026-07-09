// Aba de configuracoes do user
const botaoExplore = document.querySelector('.explore__rodape--button');
const abaConfiguracoes = document.querySelector('.configuracoes');
const abaPrincipal = document.querySelector('.universal')

botaoExplore.addEventListener('click', function() {

      if (abaConfiguracoes.style.display !== 'revert') {
        abaConfiguracoes.style.display = 'flex';
        abaConfiguracoes.style.flexDirection = 'column';
        abaPrincipal.style.width = '60%';
        abaPrincipal.style.transition = '0.3s';
    } else {
        abaConfiguracoes.style.display = 'none';
        abaPrincipal.style.width = '100%';
        abaPrincipal.style.transition = '0.3s';
    }
});
