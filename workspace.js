function summarizeTopology(devices, links) {
    const byId = new Map(devices.map(device => [device.id, device]));
    const neighbors = new Map(devices.map(device => [device.id, new Set()]));
    let cables = 0;

    for (const { sourceId, targetId } of links) {
        if (sourceId === targetId || !byId.has(sourceId) || !byId.has(targetId)) continue;
        cables++;
        neighbors.get(sourceId).add(targetId);
        neighbors.get(targetId).add(sourceId);
    }

    const visited = new Set();
    const groups = [];
    for (const id of byId.keys()) {
        if (visited.has(id)) continue;
        const group = [];
        const pending = [id];
        visited.add(id);
        while (pending.length) {
            const next = pending.pop();
            group.push(byId.get(next));
            for (const neighbor of neighbors.get(next)) {
                if (visited.has(neighbor)) continue;
                visited.add(neighbor);
                pending.push(neighbor);
            }
        }
        groups.push(group);
    }

    return {
        devices: byId.size,
        cables,
        groups,
        isolated: groups.filter(group => group.length === 1).length,
    };
}

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
