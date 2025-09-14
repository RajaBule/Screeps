global.spawnScout = function(target = null) {
    if (!target) {
        console.log("❌ You must provide a target room, e.g., spawnScout('E49S19')");
        return;
    }

    const spawn = Game.spawns['Main1'];
    const body = [CLAIM, MOVE]; // minimum claimer scout

    const cost = _.sum(body, part => BODYPART_COST[part]);
    if (spawn.room.energyAvailable >= cost) {
        const name = 'Scout' + Game.time;
        spawn.spawnCreep(body, name, {
            memory: {
                role: 'scout',
                targetRoom: target
            }
        });
        console.log('🛰️ Spawning claimer scout: ' + name + ' to ' + target);
    } else {
        console.log(`❌ Not enough energy to spawn claimer scout (need ${cost})`);
    }
};
