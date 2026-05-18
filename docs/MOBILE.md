# Mobile e PWA

O frontend do Inventário TI foi preparado para uso em celular e tablet, com suporte a instalação como PWA.

## O que o usuário vê no mobile

- menu lateral compactado
- botões maiores para toque
- tabelas com rolagem horizontal controlada
- modais com rolagem interna
- contraste compatível com tema claro e escuro

## Instalação no Android

1. Abra o sistema no Chrome.
2. Toque no menu do navegador.
3. Selecione **Instalar app** ou **Adicionar à tela inicial**.
4. Confirme.

## Instalação no iPhone

1. Abra o sistema no Safari.
2. Toque em **Compartilhar**.
3. Selecione **Adicionar à Tela de Início**.
4. Confirme.

## Validação no mobile

Teste estes fluxos após instalar:

- login
- dashboard
- ativos
- funcionários
- auditoria
- relatórios
- QR Code
- anexos e uploads
- impressão de etiquetas

## Acesso pela rede local

Se o celular estiver na mesma rede do servidor:

1. Descubra o IP da máquina que roda o Docker.
2. Acesse a Web pela porta configurada em `WEB_PORT`.
3. Garanta que `NEXT_PUBLIC_API_URL` aponte para a API acessível pelo dispositivo.

## Boas práticas

- Não use o sistema instalado via PWA sem validar login e permissões primeiro.
- Teste também com tema escuro.
- Teste com largura pequena e rotação do dispositivo.

