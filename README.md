# MarketPreço

Crie o projeto real "MarketPreço" desde zero. Plataforma colaborativa de preços de supermercados, em pt-BR, mobile-first, React + TypeScript + Tailwind + shadcn/ui, identidade verde-petróleo, branco e cinza claro. Evite telas demonstrativas e dados falsos. Implemente primeiro um núcleo funcional e persistente no Lovable Cloud/PostgreSQL com autenticação, RLS, cadastros de unidades individuais de supermercados (endereço, cidade, localização), produtos (nome, marca, embalagem, código de barras opcional), listas de compras privadas com itens, quantidade decimal, preço unitário, orçamento, subtotal e totais calculados, CRUD completo, histórico de compra, registro de observações de preços confirmado pelo usuário e vinculado a loja, produto e data. Leitor de códigos EAN/GTIN por câmera com opção de digitar manualmente e fallback para permissão negada. Navegação: Início, Escanear, Minha Lista, Mapa, Comparar. Mapa, comparação de listas, OCR de etiqueta e gráficos podem ser implementados em fases posteriores caso o núcleo não esteja pronto, sem fingir que funcionam. Não usar preços ausentes como zero, nem permitir comparar produtos diferentes inadvertidamente; exibir cobertura de comparação. Estrutura relacional profiles, stores, products, shopping_lists, shopping_list_items, price_observations, price_reports, user_roles; políticas de segurança no servidor. Preço colaborativo público apenas quando autorizado, informações pessoais privadas. Não inventar integração ou teste. Para esta primeira execução, priorize criar o banco de dados e um fluxo ponta a ponta: escolher supermercado -> cadastrar/localizar produto -> inserir preço -> adicionar à lista -> persistir -> mostrar total. Ao final, reporte objetivamente funcionalidades reais e pendências.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/482940e2-4470-4581-b1cd-29127973094e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
