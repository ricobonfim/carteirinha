# Carteirinha Estudantil

Gerador de carteirinha estudantil em PDF a partir de um template `.odt`. Preencha o formulário com os dados do estudante e baixe o documento pronto.

## Funcionalidades

- Substituição de placeholders em arquivo `.odt` com dados do formulário
- Conversão automática para PDF via LibreOffice
- Datas automáticas (data do documento, validade, ano e mês atual)
- Formatação automática de CPF e CEP
- Autenticação simples por token na URL
- Interface no estilo terminal hacker (temática Anônimos)

## Placeholders disponíveis no template

Adicione estes marcadores no arquivo `template.odt` exatamente como escrito (com as chaves):

| Placeholder | Descrição |
|---|---|
| `{FULL_NAME_HERE}` | Nome completo do estudante |
| `{CPF_HERE}` | CPF formatado (000.000.000-00) |
| `{CEP_HERE}` | CEP formatado (00000-000) |
| `{ADDRESS_HERE}` | Endereço completo (Rua, Número, Complemento, Bairro, Cidade) |
| `{DOCUMENT_DATE}` | Último dia do mês anterior (DD/MM/AAAA) |
| `{EXPIRE_DATE}` | Dia 15 do mês atual (DD/MM/AAAA) |
| `{SHORT_EXPIRE_DATE}` | Dia 15 do mês atual (DD/MM/AA) |
| `{CYEAR}` | Ano atual com 4 dígitos |
| `{CMONTH}` | Mês atual sem zero à esquerda |

> **Importante:** os placeholders devem estar em texto simples e sem formatação mista (não aplique negrito/itálico apenas em parte do placeholder).

## Rodando localmente

**Pré-requisitos:** Node.js 18+ e LibreOffice instalados.

```bash
# Instalar LibreOffice (Ubuntu/Debian)
sudo apt install libreoffice --no-install-recommends

# Instalar dependências
npm install

# Iniciar o servidor
node server.js
```

Acesse: `http://localhost:3100/?token=anon-xK9mP2vL7nQ4rZ8wB3`

### Alterando o token de acesso

```bash
ACCESS_TOKEN=meu-token-secreto node server.js
```

## Rodando com Docker

```bash
docker compose up --build
```

Para alterar o token, edite `docker-compose.yml`:

```yaml
environment:
  - ACCESS_TOKEN=meu-token-secreto
```

## Deploy no Render (gratuito)

1. Faça push do repositório no GitHub (certifique-se de incluir o `template.odt`)
2. Crie uma conta em [render.com](https://render.com)
3. **New Web Service** → conecte o repositório
4. Configure:
   - **Environment:** `Docker`
   - **Dockerfile path:** `./Dockerfile`
   - **Instance type:** `Free`
5. Em **Environment Variables**, adicione:
   - `ACCESS_TOKEN` → seu token escolhido
6. Clique em **Deploy**

A URL pública será algo como `https://carteirinha.onrender.com`.  
Compartilhe o link com o token: `https://carteirinha.onrender.com/?token=SEU_TOKEN`

> **Atenção:** no plano gratuito do Render o serviço hiberna após 15 minutos sem uso e leva ~30s para acordar na próxima requisição.

## Estrutura do projeto

```
├── Dockerfile
├── docker-compose.yml
├── server.js          # API Express + geração do PDF
├── template.odt       # Template com os placeholders (não versionado se contiver dados sensíveis)
├── public/
│   └── index.html     # Formulário frontend
└── package.json
```
