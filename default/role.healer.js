var roleHealer = {
    /** @param {Creep} creep **/
    run: function(creep) {
        // === Find injured creeps nearby ===
        let injured = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: (c) => c.hits < c.hitsMax
        });

        if (injured) {
            // If adjacent, heal directly
            if (creep.heal(injured) == ERR_NOT_IN_RANGE) {
                creep.moveTo(injured, { visualizePathStyle: { stroke: '#00ff00' } });
            }
        } else {
            // No one is injured, follow closest combat creep
            let target = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: (c) => c.memory.role == 'attacker' || c.memory.role == 'tank'
            });
            if (target) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#0099ff' } });
            } else {
                // Default: idle near spawn or flag
                let spawn = Game.spawns['Spawn1'];
                creep.moveTo(spawn);
            }
        }
    }
};

module.exports = roleHealer;
