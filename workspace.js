const WorkspaceStorage = {
    key: 'wpt_switchlab_enterprise_v3',

    parse(serialized) {
        const topology = JSON.parse(serialized);
        if (!topology || !Array.isArray(topology.devices) || !Array.isArray(topology.links)
            || (topology.zones != null && !Array.isArray(topology.zones))) {
            throw new Error('Formato de topologia inválido');
        }

        const ids = new Set();
        const types = ['pc', 'laptop', 'server', 'router', 'switch', 'cloud'];
        for (const device of topology.devices) {
            if (!device || typeof device.id !== 'string' || ids.has(device.id)
                || !types.includes(device.typeStr) || !Number.isFinite(device.x)
                || !Number.isFinite(device.y) || !Array.isArray(device.interfaces)) {
                throw new Error('Dispositivo inválido');
            }
            ids.add(device.id);
        }
        if (topology.links.some(link => !link || !ids.has(link.sourceId) || !ids.has(link.targetId))
            || topology.zones?.some(zone => !zone || typeof zone.id !== 'string')) {
            throw new Error('Referência inválida');
        }
        return topology;
    },

    save(storage, serialized) {
        storage.setItem(this.key, serialized);
    },

    load(storage) {
        const serialized = storage.getItem(this.key);
        return serialized === null ? null : this.parse(serialized);
    },
};
