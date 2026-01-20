/**
 * NEON BRAIN V3.0 - MOTOR LÓGICO INDEPENDIENTE
 */

const NEON_CORE = {
    config: {
        calibrationTarget: 37, // Tiros necesarios para salir de Fase 1
        ghostTarget: 10,       // Tiros de prueba en Fase 2
        minAccuracy: 40,       // % mínimo para pasar a Fase 3
        baseUnit: 1000         // Apuesta inicial
    },

    state: {
        history: [],
        phase: 'CALIBRATION', // CALIBRATION -> GHOST -> ACTIVE
        balance: 0,
        currentBet: 0,
        betLevel: 1, // Nivel D'Alembert
        ghostWins: 0,
        ghostTotal: 0,
        lastPrediction: null
    },

    // INICIALIZAR
    init: function(startBalance) {
        this.state.balance = startBalance;
        this.state.currentBet = this.config.baseUnit;
        console.log("NEON BRAIN ONLINE");
    },

    // PROCESAR NÚMERO (El corazón del sistema)
    processSpin: function(number) {
        // 1. Guardar historial
        this.state.history.unshift(number);
        
        // 2. Verificar Fase y Transiciones
        this.checkPhaseTransition();

        // 3. Generar Predicción
        let prediction = this.predictDozen();

        // 4. Calcular Resultado (Si había predicción anterior)
        let result = null;
        if (this.state.lastPrediction) {
            result = this.calculateResult(number, this.state.lastPrediction);
        }

        // 5. Guardar predicción para el siguiente tiro
        this.state.lastPrediction = prediction;

        return {
            phase: this.state.phase,
            prediction: prediction,
            bet: this.state.currentBet,
            balance: this.state.balance,
            historyCount: this.state.history.length,
            lastResult: result
        };
    },

    // MÁQUINA DE ESTADOS (Aquí estaba el bug, ahora corregido)
    checkPhaseTransition: function() {
        let count = this.state.history.length;

        // De Calibración a Ghost
        if (this.state.phase === 'CALIBRATION' && count >= this.config.calibrationTarget) {
            this.state.phase = 'GHOST';
            this.state.ghostWins = 0;
            this.state.ghostTotal = 0;
        }

        // De Ghost a Active
        if (this.state.phase === 'GHOST') {
            if (this.state.ghostTotal >= this.config.ghostTarget) {
                let accuracy = (this.state.ghostWins / this.state.ghostTotal) * 100;
                if (accuracy >= this.config.minAccuracy) {
                    this.state.phase = 'ACTIVE';
                } else {
                    // Si falla, reinicia el contador Ghost para intentar de nuevo
                    this.state.ghostTotal = 0;
                    this.state.ghostWins = 0;
                }
            }
        }
    },

    // ALGORITMO DE PREDICCIÓN (Ley del Tercio + Retraso)
    predictDozen: function() {
        if (this.state.history.length < 10) return null;

        let counts = { 1: 0, 2: 0, 3: 0 };
        // Analizamos los últimos 30 tiros
        let window = this.state.history.slice(0, 30);
        
        window.forEach(n => {
            if (n !== 0) counts[Math.ceil(n/12)]++;
        });

        // Buscamos la docena que MENOS ha salido (Ley del Tercio)
        let sorted = Object.keys(counts).sort((a,b) => counts[a] - counts[b]);
        return parseInt(sorted[0]); // Retorna la docena más fría
    },

    // CÁLCULO DE DINERO (D'Alembert)
    calculateResult: function(number, predictedDozen) {
        let realDozen = (number === 0) ? 0 : Math.ceil(number / 12);
        let won = (realDozen === predictedDozen);

        if (this.state.phase === 'GHOST') {
            this.state.ghostTotal++;
            if (won) this.state.ghostWins++;
            return { won: won, amount: 0 };
        }

        if (this.state.phase === 'ACTIVE') {
            let amount = this.state.currentBet;
            
            if (won) {
                this.state.balance += (amount * 2); // Pago 2:1
                this.state.betLevel = Math.max(1, this.state.betLevel - 1); // Baja apuesta
            } else {
                this.state.balance -= amount;
                this.state.betLevel++; // Sube apuesta
            }
            
            // Actualizar apuesta para el siguiente tiro
            this.state.currentBet = this.state.betLevel * this.config.baseUnit;
            
            return { won: won, amount: (won ? amount * 2 : -amount) };
        }

        return null;
    },

    // RESET
    reset: function() {
        this.state.history = [];
        this.state.phase = 'CALIBRATION';
        this.state.betLevel = 1;
        this.state.lastPrediction = null;
    }
};
