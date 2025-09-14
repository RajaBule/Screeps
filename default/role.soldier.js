const roleSoldier = {
    run: function(creep) {
        // Look for closest hostile creep
        const target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);

        if (target) {
            if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
            }
            creep.memory.action = `Attacking ${target.owner.username}'s creep`;
            creep.memory.nextAction = "Keep attacking until destroyed";
            return;
        }

        // Patrol near spawn
        const spawn = Game.spawns['Main1'];
        if (!spawn) return;

        // Assign a new patrol position if none exists or creep is close enough to previous one
        if (
            !creep.memory.patrolPos ||
            creep.pos.getRangeTo(creep.memory.patrolPos.x, creep.memory.patrolPos.y) <= 1
        ) {
            const newX = spawn.pos.x + Math.floor(Math.random() * 11) - 5; // -5 to 5
            const newY = spawn.pos.y + Math.floor(Math.random() * 11) - 5;

            creep.memory.patrolPos = { x: newX, y: newY, roomName: spawn.pos.roomName };
        }

        const patrolPos = new RoomPosition(
            creep.memory.patrolPos.x,
            creep.memory.patrolPos.y,
            creep.memory.patrolPos.roomName
        );

        creep.moveTo(patrolPos, { visualizePathStyle: { stroke: '#00ff00' } });
        creep.memory.action = "Patrolling";
        creep.memory.nextAction = "Await hostiles";
    }
};

module.exports = roleSoldier;
