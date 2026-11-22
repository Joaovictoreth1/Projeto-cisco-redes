# 🌐 Web Packet Tracer Pro | SwitchLab Ultra Enterprise

> Simulador interativo avançado de redes Cisco (Packet Tracer Web) com interface gráfica moderna, emulação de dispositivos em tempo real, console CLI Cisco IOS, animação de pacotes e gestão de topologias.

[![GitHub Pages Deploy](https://img.shields.io/badge/demo-live%20online-0ea5e9?style=for-the-badge&logo=google-chrome&logoColor=white)](https://joaovictoreth1.github.io/Projeto-cisco-redes/)
[![License](https://img.shields.io/badge/license-MIT-purple?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Web%20Browser-10b981?style=for-the-badge&logo=html5&logoColor=white)](https://joaovictoreth1.github.io/Projeto-cisco-redes/)
[![Stack](https://img.shields.io/badge/stack-Tailwind%20%7C%20SVG%20%7C%20JS%20OOP-8b5cf6?style=for-the-badge)](https://joaovictoreth1.github.io/Projeto-cisco-redes/)

---

## 🚀 Demonstração Rápida

Acesse o simulador diretamente pelo navegador sem instalar nada:  
👉 **[https://joaovictoreth1.github.io/Projeto-cisco-redes/](https://joaovictoreth1.github.io/Projeto-cisco-redes/)**

---

## 📋 Sumário

- [Visão Geral](#-visão-geral)
- [Funcionalidades Principais](#-funcionalidades-principais)
- [Dispositivos Suportados](#-dispositivos-suportados)
- [Tipos de Cabeamento](#-tipos-de-cabeamento)
- [Terminal CLI Cisco IOS Emulado](#-terminal-cli-cisco-ios-emulado)
- [Motor de Simulação de Tráfego](#-motor-de-simulação-de-tráfego)
- [Como Executar Localmente](#-como-executar-localmente)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Atalhos e Controles](#-atalhos-e-controles)
- [Licença](#-licença)

---

## 🎯 Visão Geral

O **Web Packet Tracer Pro** é uma solução completa para estudantes e profissionais de Redes de Computadores (preparação para certificações como **Cisco CCNA**, Network+, etc.). Ele recria a experiência do Cisco Packet Tracer diretamente no navegador, eliminando a necessidade de máquinas virtuais pesadas ou dependências Java.

O projeto utiliza **Canvas SVG de alto desempenho**, **Tailwind CSS**, **Phosphor Icons** e um motor de estado reativo escrito em **JavaScript Orientado a Objetos (OOP)** puro.

---

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

## 🛠️ Como Executar Localmente

Como o projeto é construído em tecnologias web puras (Vanilla HTML5 + JS), você não precisa compilar nada.

### Opção 1: Abrir diretamente no navegador
Basta dar um duplo clique no arquivo `index.html` ou arrastá-lo para dentro de qualquer navegador moderno (Chrome, Firefox, Edge, Opera).

### Opção 2: Servidor local com Python
```bash
# Clone o repositório
git clone https://github.com/Joaovictoreth1/Projeto-cisco-redes.git
cd Projeto-cisco-redes

# Inicie o servidor HTTP nativo do Python
python -m http.server 8080
```
Abra em seu navegador: `http://localhost:8080`

### Opção 3: Servidor com Node.js (npx)
```bash
npx serve .
```

---

## 📁 Estrutura do Projeto

```
Projeto-cisco-redes/
├── index.html                  # Aplicação completa (SPA autossuficiente)
├── .github/
│   └── workflows/
│       └── deploy.yml          # Pipeline CI/CD de deploy no GitHub Pages
├── .gitignore                  # Arquivos ignorados pelo Git
└── README.md                   # Documentação detalhada do projeto
```

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

## 📄 Licença

Distribuído sob a licença **MIT**. Veja o arquivo `LICENSE` ou consulte os termos abertos para uso educacional e profissional.

---

<p align="center">
  Desenvolvido com foco em alta performance e excelência em Redes de Computadores.<br>
  <b><a href="https://github.com/Joaovictoreth1">João Victor</a></b>
</p>
