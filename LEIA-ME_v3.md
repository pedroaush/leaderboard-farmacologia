# Pacote v3: correção v2, avisos no celular e jogo por turma

## Passo a passo (PowerShell, na pasta leaderboard-farmacologia)

1. **Extraia o zip na raiz do projeto** e substitua os arquivos existentes.
2. **Instale o pacote de notificações:**
   ```
   pnpm add web-push
   pnpm add -D @types/web-push
   ```
3. **Aplique as edições automáticas:**
   ```
   node aplicar_v3.mjs
   ```
   Todos os itens precisam aparecer com ✔. Se algum vier com ✘, mande o relatório antes de continuar. Depois apague o `aplicar_v3.mjs`.
4. **Gere as chaves de notificação:**
   ```
   npx web-push generate-vapid-keys
   ```
   No Railway, abra **Variables** e crie as três variáveis abaixo. A chave privada não deve ser colada em nenhum outro lugar.
   ```
   VAPID_PUBLIC_KEY=<Public Key>
   VAPID_PRIVATE_KEY=<Private Key>
   VAPID_SUBJECT=mailto:pedro.alexandre@unirio.br
   ```
5. **Teste a compilação no computador:** `pnpm run build`. Ela precisa terminar sem erro.
6. **Envie para o ar:**
   ```
   git add -A
   git commit -m "v3: correção v2, notificações e jogo por turma"
   git push
   ```

## Depois do deploy

### Correção v2
1. Abra o painel do professor, aperte F12 e vá à aba Console.
2. Cole o conteúdo de `P1_salvar_mapa.js`. Ele grava os gabaritos e o mapa das versões A–E.
3. Abra `/correcao/painel?p=P1&c=1`. O painel mostra notas, distribuição, % de acerto e discriminação por questão, questões para anular e ausentes.
4. Clique em **Liberar resultado** só depois da 2ª chamada (13/10). A partir daí o aluno vê o próprio resultado na aba **Provas**.

### Notificações no celular
- O aluno toca em **Ativar notificações** no topo da Área do Aluno e recebe na hora o aviso "Notificações ativadas ✅".
- Cada material publicado avisa todos os inscritos: arquivo, link ou comentário. Tocar no aviso abre a aba Materiais.
- No Android, use o Chrome.
- No iPhone, use o Safari: **Compartilhar → Adicionar à Tela de Início**. Depois abra pelo ícone e ative. O cartão explica isso ao aluno.
- Para ver quantos aparelhos estão inscritos, cole no Console:
  ```js
  fetch('/api/trpc/notificacoes.resumo?input=' + encodeURIComponent(JSON.stringify({json:{password: localStorage.getItem("teacherSessionToken")}}))).then(r=>r.json()).then(d=>console.table(d.result.data.json.porTurma))
  ```

### Jogo por turma
- Farmacologia I (Medicina e Biomedicina) passa a ter só os 9 temas.
  - A semana 4, antes "Boas Práticas de Prescrição", agora cobre Farmacodinâmica: dose-resposta, potência, eficácia e índice terapêutico.
  - Os 15 chefes foram reescritos para seguir o cronograma. Saíram antimicrobianos, opioides, anestésicos gerais, cardiovascular, diuréticos, oncologia etc.
  - O status dos chefes agora cobre as semanas 1–15. Antes parava na semana 10.
- Farmacologia II fica com o banco vazio. A turma vê "Jogo em preparação".
- Para conferir qual disciplina foi atribuída a cada turma, cole no Console:
  ```js
  fetch('/api/trpc/game.listarDisciplinas').then(r=>r.json()).then(d=>console.table(d.result.data.json))
  ```
- Se alguma turma estiver com a disciplina errada, corrija pelo Console (troque o classId):
  ```js
  fetch('/api/trpc/game.definirDisciplinaTurma',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({json:{sessionToken:localStorage.getItem("teacherSessionToken"),classId:22,disciplina:"farmaco2"}})}).then(r=>r.json()).then(console.log)
  ```

**Para desfazer tudo** (antes do commit): `git checkout -- server client shared`
