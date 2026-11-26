# Web Packet Tracer Pro — SwitchLab

Simulador de redes Cisco que roda inteiramente no navegador: monte topologias com roteadores, switches, hosts e nuvem WAN, configure-os por um console no estilo IOS e observe ARP, ICMP e DHCP animados no canvas.

**Demo:** https://joaovictoreth1.github.io/Projeto-cisco-redes/

## Funcionalidades

- Canvas com arrastar, pan, zoom, alinhamento à grade e zonas de sub-rede editáveis.
- Cabos direto, cross-over e fibra, com seletor de porta física e LEDs de estado por porta.
- Console por dispositivo:
  - **Hosts:** `ping`, `traceroute`, `ipconfig`, `arp -a`, `dhcp`.
  - **IOS:** `enable`, `conf t`, `interface gi0/1`, `ip address`, `[no] shutdown`, `ip route`, `hostname`, `show ip int brief`, `show ip route`, `show run` e `show mac`.
  - Abreviações aceitas, histórico com ↑/↓ e autocompletar com Tab.
- Roteamento estático por prefixo mais longo, aprendizado de MAC nos switches e servidor DHCP com pool limitado à sub-rede.
- Log de PDUs com inspetor de cabeçalhos OSI (L1–L4).
- Desfazer/refazer, salvar no `localStorage` e importar/exportar JSON validado.
- Quatro laboratórios prontos: Core/WAN, Dual-LAN, Backbone multi-hop e DHCP.

## Arquitetura

```
index.html            marcação estática (sem scripts ou handlers inline)
src/main.ts           bootstrap, delegação de eventos (data-action / data-change), teclado e ponteiro
src/core/             domínio puro, sem DOM, 100% coberto por testes
  types.ts            modelo: Device, NetInterface, Link, Zone, Topology
  ip.ts               IPv4, máscaras contíguas, rede/broadcast, MAC
  devices.ts          fábrica de dispositivos (contador só avança na criação)
  network.ts          caminho L2, tabela MAC, roteamento LPM, traceroute, DHCP
  cli.ts              interpretador IOS/host puro, que retorna linhas e ações
  topology.ts         enlaces, remoção, serialização e validação estrita de importação
  presets.ts          laboratórios prontos
  history.ts          pilha de snapshots para desfazer/refazer
src/ui/               camada de apresentação: renderiza o estado com DOM seguro
  dom.ts              h()/svg(), que sempre atribuem texto via textContent
  engine.ts           dispositivos, cabos, animação de pacotes, ping/traceroute/DHCP
  properties.ts       painel de propriedades e serviços
  cli-panel.ts        terminal
  persistence.ts      histórico, localStorage, importação/exportação e presets
  ...                 toast, modal, menu de contexto, catálogo, viewport e som
```

A regra de negócio fica em `src/core`, que é determinístico e testável em Node. A UI só traduz eventos em chamadas ao core e redesenha.

## Segurança

- **Sem HTML a partir de dados:** todo texto vindo do usuário ou de arquivos é inserido com `textContent`. O ESLint proíbe `innerHTML`, `outerHTML`, `insertAdjacentHTML` e `eval`.
- **Importação validada antes de mexer no estado:** `parseTopology` reconstrói cada campo e valida IPs, máscaras, MACs, portas, referências de enlace e limites (500 dispositivos, 2.000 enlaces). Chaves desconhecidas, incluindo `__proto__`, são descartadas, e arquivos acima de 5 MB são recusados. O mesmo caminho vale para o `localStorage` e para os snapshots de desfazer.
- **CSP estrita no build:** `default-src 'self'`, sem `unsafe-inline` ou `unsafe-eval`. Fontes e ícones são empacotados no build, sem CDN em tempo de execução.
- **Imagem Docker:** nginx sem root, com CSP, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`.

## Desenvolvimento

Requisitos: Node 22 (veja `.nvmrc`; mínimo 20.19).

```bash
npm ci
npm run dev          # http://localhost:5173
```

| Comando                 | O que faz                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| `npm run build`         | typecheck + build de produção em `dist/`                         |
| `npm run preview`       | serve `dist/` em http://localhost:4173                           |
| `npm run lint`          | ESLint (typescript-eslint strict), zero warnings                 |
| `npm run format:check`  | Prettier                                                         |
| `npm run typecheck`     | `tsc --noEmit` (app e testes)                                    |
| `npm test`              | testes unitários (Vitest)                                        |
| `npm run test:coverage` | cobertura do core, com mínimo de 95% de linhas e 90% de branches |
| `npm run test:e2e`      | Playwright contra o build de produção                            |
| `npm run check`         | todos os gates acima, exceto e2e                                 |

O `Makefile` expõe os mesmos alvos (`make check`, `make e2e`, `make docker-run`).

Não há variáveis de ambiente: a aplicação é 100% estática e não tem backend.

## Formato do arquivo de topologia

Os arquivos exportados usam `version: "4.0"`. Arquivos `3.0` de versões anteriores continuam sendo aceitos.

```json
{
  "version": "4.0",
  "deviceCounter": 6,
  "devices": [{ "id": "dev_1_x", "typeStr": "router", "name": "R1", "x": 400, "y": 200, "interfaces": [] }],
  "links": [
    { "id": "link_x", "sourceId": "dev_1_x", "srcIntf": 0, "targetId": "dev_2_y", "tgtIntf": 0, "type": "straight" }
  ],
  "zones": []
}
```

## Deploy

- **GitHub Pages:** `.github/workflows/deploy.yml` roda o CI completo, gera `dist/` e publica somente o build.
- **Docker:**
  ```bash
  docker build -t projeto-cisco-redes .
  docker run --rm -p 8080:8080 projeto-cisco-redes   # http://localhost:8080, health em /healthz
  ```

## CI

`.github/workflows/ci.yml` roda em todo push e PR:

- formatação, lint, typecheck e testes com cobertura;
- `npm audit` das dependências de produção;
- build de produção, e2e no Chromium e build da imagem Docker.

## Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE).
