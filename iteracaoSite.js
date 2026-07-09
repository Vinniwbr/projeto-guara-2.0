// Aba de configuracoes do user
const botaoExplore = document.getElementsByClassName('explore__rodape--button');
const abaConfiguracoes = document.getElementsByClassName('configuracoes');
const abaPrincipal = document.getElementsByClassName('principal')

botaoExplore[0].addEventListener('click', function() {

    if (abaConfiguracoes[0].style.display === 'none') {
        abaConfiguracoes[0].style.display = 'revert';
        abaPrincipal[0].style.width = '75%';
    } else {
        abaConfiguracoes[0].style.display = 'none';
        abaPrincipal[0].style.width = '100%';
        abaPrincipal[0].style.transition = '0.3s';
    }

});

