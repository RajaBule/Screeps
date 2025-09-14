// controllerTracker
global.trackControllerEnergy = function() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;

        const ctrl = room.controller;
        if (!Memory.ctrlEnergy) Memory.ctrlEnergy = {};
        if (!Memory.ctrlEnergy[ctrl.id]) {
            Memory.ctrlEnergy[ctrl.id] = {
                lastProgress: ctrl.progress,
                energyPerTick: 0,
                history: []
            };
        }

        const data = Memory.ctrlEnergy[ctrl.id];

        // Calculate gained energy this tick
        const gained = ctrl.progress - data.lastProgress;
        data.energyPerTick = gained;
        data.lastProgress = ctrl.progress;

        // Keep last 50 ticks for averaging
        data.history.push(gained);
        if (data.history.length > 50) data.history.shift();

        const avg = _.sum(data.history) / data.history.length;

        // Console log
        console.log(`[${roomName}] Controller +${gained}/tick (avg ${avg.toFixed(2)}/tick)`);

        // Visual display in game
        room.visual.text(
            `+${gained}/tick (avg ${avg.toFixed(2)})`,
            ctrl.pos.x + 1,
            ctrl.pos.y,
            { color: 'yellow', font: 0.6 }
        );
    }
};
