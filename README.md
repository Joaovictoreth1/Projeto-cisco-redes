# SwitchLab

Simulador didático de topologias de rede, sem alterar redes reais. Monte uma topologia, salve-a no navegador ou exporte um backup JSON. Os recursos visuais usam CDNs.

## Rodar localmente

Na raiz do repositório, execute:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Abra <http://localhost:8000/>.

## Estrutura

`index.html`: simulador. `workspace.js`: leitura e validação dos dados de topologia. `workspace.test.mjs`: testes (`node --test`, Node 24). `.github/workflows/deploy.yml`: publicação da branch `main`.

Para publicar, o mantenedor deve verificar em **Settings → Pages** que a origem é **GitHub Actions**; se necessário, habilite-a e rode o deploy a partir de `main`. A validação das branches não publica a aplicação.

A CI valida o HTML e verifica arquivos e âncoras locais. Links e serviços externos não são consultados pela CI.

## ✨ Funcionalidades Principais

- 🖧 **Workspace Infinito com Grade Magnética (Snap to Grid):**
  - Área de trabalho de 4000x4000px com zoom dinâmico e pan suave.
  - Alinhamento automático à grade modular de 40px.
- 🔌 **Cabeamento Dinâmico Inteligente:**
  - Traçado de cabos com curvas gravitacionais (Bézier).
  - Luzes de enlace (Link Lights) verde (UP) e vermelho (DOWN) em tempo real.
  - Verificação de portas compatíveis e seletor de interface por dispositivo.
- 💻 **Terminal CLI Cisco IOS Realista:**
  - Modos de execução: Usuário (`>`), Privilegiado (`#`), e Configuração Global (`(config)#`).
  - Navegação de histórico com setas `↑` e `↓`.
  - Auto-completar com tecla `Tab`.
  - Suporte a `?` para listar comandos disponíveis contextualmente.
- 📦 **Simulador de Pacotes em Tempo Real:**
  - Animação visual de pacotes ICMP (Ping) trafegando pelos enlaces.
  - Resolução ARP automática e visualização de pacotes de retorno.
  - Modos de simulação: Tempo Real e Passo a Passo (Event List).
- 🏷️ **Zonas e Anotações de Sub-rede:**
  - Criação de áreas visuais delimitadoras para sub-redes e VLANs.
  - Nomenclatura customizada e identificação visual por cores.
- 💾 **Persistência e Presets:**
  - Salve e exporte a topologia completa em formato JSON.
  - Importe topologias salvas.
  - Laboratórios pré-configurados prontos para estudo.

---

## 🖥️ Dispositivos Suportados

| Categoria | Dispositivo | Portas / Interfaces |
|---|---|---|
| **Roteadores** | Cisco 2911 / 1941 Router | GigabitEthernet 0/0, GigabitEthernet 0/1, Serial |
| **Switches** | Catalyst 2960 (Layer 2) | FastEthernet 0/1 a 0/24, Gigabit 0/1 a 0/2 |
| **Switches L3** | Catalyst 3560 (Multilayer) | FastEthernet 0/1 a 0/24, SVIs (Interface VLAN) |
| **End Devices** | PC Desktop | FastEthernet0 (Configuração IP estática ou DHCP) |
| **End Devices** | Laptop | FastEthernet0 / Wireless |
| **End Devices** | Server | HTTP, DNS, DHCP Server |
| **WAN / Nuvem** | Cloud (Internet) | Ethernet, Serial |

---

## 🔗 Tipos de Cabeamento

| Tipo de Cabo | Indicador Visual | Aplicação Típica |
|---|---|---|
| **Auto-Detect** | Traço cinza suave | Conecta automaticamente a melhor porta disponível |
| **Direto (Straight-Through)** | Linha sólida escura | Conexão entre dispositivos de camadas diferentes (ex: PC ↔ Switch) |
| **Cruzado (Crossover)** | Linha tracejada | Conexão entre dispositivos da mesma camada (ex: Switch ↔ Switch, PC ↔ PC) |
| **Fibra Óptica** | Linha âmbar pulsante | Conexões de alta velocidade e uplinks de roteadores |

---

## ⌨️ Terminal CLI Cisco IOS Emulado

O terminal suporta uma ampla variedade de comandos Cisco IOS autênticos:

```bash
# Modo Privilegiado
Router> enable
Router#

# Modo de Configuração
Router# configure terminal
Router(config)# hostname R1-Borda
R1-Borda(config)#

# Configuração de Interface
R1-Borda(config)# interface gigabitEthernet 0/0
R1-Borda(config-if)# ip address 192.168.1.1 255.255.255.0
R1-Borda(config-if)# no shutdown
R1-Borda(config-if)# exit

# Comandos de Diagnóstico e Visualização
R1-Borda# show ip interface brief
R1-Borda# show running-config
R1-Borda# show vlan brief
R1-Borda# ping 192.168.1.10
```

---

## ⚡ Motor de Simulação de Tráfego

```
[ PC-A (192.168.1.10) ]
        │ (Cabo Direto)
        ▼
[ Switch Catalyst 2960 ] ──── Link Trunk ──── [ Router Cisco 2911 ]
        │ (Cabo Direto)
        ▼
[ PC-B (192.168.1.20) ]
```

Ao disparar um teste de ping via ferramenta gráfica ou linha de comando:
1. O dispositivo de origem verifica sua tabela ARP e tabela de roteamento.
2. Um pacote visual com efeito de brilho neon percorre o cabo conectado até o próximo hop.
3. Se o destino responder, o pacote de retorno verde (Echo Reply) é gerado e o tempo de ida e volta (RTT) é exibido no log de eventos.

---

## 🎮 Atalhos e Controles

| Ação | Atalho / Gesto |
|---|---|
| **Mover Workspace (Pan)** | Arrastar com botão do meio do mouse ou selecionar ferramenta Mão |
| **Zoom In / Zoom Out** | Rodinha do mouse (Scroll Wheel) |
| **Selecionar Dispositivo** | Clique com botão esquerdo |
| **Menu de Contexto / Configuração** | Clique com botão direito no dispositivo |
| **Conectar Cabo** | Selecionar ferramenta Cabo, clicar na origem e depois no destino |
| **Disparar Ping Rápido** | Selecionar ferramenta Ping, clicar na origem e depois no destino |
| **Deletar Elemento** | Selecionar ferramenta Lixeira ou pressionar `Delete` |

---
