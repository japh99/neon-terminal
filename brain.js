/**
 * 🧠 NEON BRAIN V3.0 - MOTOR LÓGICO INDEPENDIENTE
 * Sistema de predicción matemática para ruleta europea
 * Separado completamente de la interfaz para evitar bugs
 */

const NEON_CORE = {
    // ============================================
    // CONFIGURACIÓN DEL SISTEMA
    // ============================================
    config: {
        calibrationTarget: 37,       // Tiros necesarios para salir de Fase 1
        ghostTarget: 10,             // Tiros de prueba en Fase 2
        minAccuracy: 40,             // % mínimo para pasar a Fase 3 (ajustado para testing)
        baseUnit: 100,               // Apuesta inicial (1% del capital)
        maxConsecutiveLosses: 3,     // Límite de pérdidas para protección
        analysisWindow: 37,          // Ventana de análisis (ciclo completo)
        dozenWeight: 15,             // Peso del déficit de docena
        delayWeight: 3,              // Peso del retraso
        deviationWeight: 30          // Peso de la desviación estándar
    },

    // ============================================
    // ESTADO INTERNO (PRIVADO)
    // ============================================
    state: {
        // Historial de números
        history: [],
        
        // Fases: CALIBRATION -> GHOST -> ACTIVE -> PROTECTION
        phase: 'CALIBRATION',
        
        // Gestión de capital
        balance: 0,
        initialBalance: 0,
        currentBet: 0,
        betLevel: 1,
        unitSize: 0,
        
        // Estadísticas de calibración (Ghost Mode)
        ghostWins: 0,
        ghostTotal: 0,
        ghostHistory: [],
        
        // Control de rachas
        consecutiveLosses: 0,
        consecutiveWins: 0,
        
        // Predicciones
        lastPrediction: null,
        currentPrediction: null,
        
        // Meta y protección
        profitTarget: 15000,
        stopLoss: 5000,
        
        // Historial de resultados
        resultHistory: []
    },

    // ============================================
    // INTERFAZ PÚBLICA - MÉTODOS PRINCIPALES
    // ============================================

    /**
     * INICIALIZAR EL SISTEMA
     * @param {number} startBalance - Saldo inicial
     */
    init: function(startBalance) {
        this.state.balance = startBalance;
        this.state.initialBalance = startBalance;
        this.state.unitSize = startBalance * 0.01; // 1% del capital
        this.state.currentBet = this.config.baseUnit;
        this.state.phase = 'CALIBRATION';
        this.state.history = [];
        this.state.ghostWins = 0;
        this.state.ghostTotal = 0;
        this.state.consecutiveLosses = 0;
        this.state.consecutiveWins = 0;
        this.state.betLevel = 1;
        
        console.log("🧠 NEON BRAIN V3.0 INICIADO");
        console.log(`Saldo inicial: $${startBalance.toLocaleString()}`);
        console.log(`Unidad base: $${this.state.unitSize.toLocaleString()}`);
    },

    /**
     * PROCESAR UN NÚMERO DE RULETA
     * @param {number} number - Número de la ruleta (0-36)
     * @returns {object} Resultado del procesamiento
     */
    processSpin: function(number) {
        // Validar entrada
        if (number < 0 || number > 36 || !Number.isInteger(number)) {
            console.error("Número inválido:", number);
            return this._getCurrentState();
        }
        
        // 1. Registrar en historial
        this.state.history.unshift(number);
        
        // 2. Verificar transiciones de fase
        this._checkPhaseTransitions();
        
        // 3. Generar predicción para el próximo tiro
        this.state.currentPrediction = this._analyzeAndPredict();
        
        // 4. Calcular resultado del tiro anterior (si había predicción)
        let lastResult = null;
        if (this.state.lastPrediction) {
            lastResult = this._calculateResult(number, this.state.lastPrediction);
            
            // Actualizar estadísticas según fase
            this._updateStatistics(lastResult);
        }
        
        // 5. Preparar para el próximo tiro
        this.state.lastPrediction = this.state.currentPrediction;
        
        // 6. Verificar condiciones de stop loss y profit target
        this._checkRiskManagement();
        
        // 7. Devolver estado actual
        return this._getCurrentState(lastResult);
    },

    /**
     * OBTENER ESTADO ACTUAL DEL SISTEMA
     * @returns {object} Estado completo
     */
    getState: function() {
        return {
            phase: this.state.phase,
            balance: this.state.balance,
            currentBet: this.state.currentBet,
            betLevel: this.state.betLevel,
            history: [...this.state.history],
            historyLength: this.state.history.length,
            ghostWins: this.state.ghostWins,
            ghostTotal: this.state.ghostTotal,
            consecutiveLosses: this.state.consecutiveLosses,
            consecutiveWins: this.state.consecutiveWins,
            unitSize: this.state.unitSize
        };
    },

    /**
     * OBTENER PREDICCIÓN ACTUAL
     * @returns {object} Predicción actual
     */
    getCurrentPrediction: function() {
        return this.state.currentPrediction;
    },

    /**
     * OBTENER PRECISIÓN ACTUAL
     * @returns {number} Precisión en porcentaje
     */
    getAccuracy: function() {
        if (this.state.ghostTotal === 0 && this.state.resultHistory.length === 0) {
            return 0;
        }
        
        // Calcular precisión de Ghost Mode
        let ghostAccuracy = 0;
        if (this.state.ghostTotal > 0) {
            ghostAccuracy = (this.state.ghostWins / this.state.ghostTotal) * 100;
        }
        
        // Calcular precisión de Active Mode
        let activeAccuracy = 0;
        if (this.state.resultHistory.length > 0) {
            const wins = this.state.resultHistory.filter(r => r.won).length;
            activeAccuracy = (wins / this.state.resultHistory.length) * 100;
        }
        
        // Usar la que tenga datos
        if (this.state.phase === 'GHOST' || this.state.phase === 'CALIBRATION') {
            return Math.round(ghostAccuracy);
        } else {
            return Math.round(activeAccuracy);
        }
    },

    /**
     * OBTENER ESTADÍSTICAS DETALLADAS
     * @returns {object} Estadísticas
     */
    getStats: function() {
        if (this.state.history.length < 10) {
            return {
                hotDozen: null,
                coldDozen: null,
                dozenStats: {1: 0, 2: 0, 3: 0},
                lastAppearance: {1: 999, 2: 999, 3: 999}
            };
        }
        
        // Analizar frecuencias de docenas
        const window = this.state.history.slice(0, Math.min(37, this.state.history.length));
        let dozenCounts = {1: 0, 2: 0, 3: 0};
        let lastAppearance = {1: 999, 2: 999, 3: 999};
        
        window.forEach((num, index) => {
            if (num !== 0) {
                const dozen = Math.ceil(num / 12);
                if (dozen >= 1 && dozen <= 3) {
                    dozenCounts[dozen]++;
                    if (lastAppearance[dozen] === 999) {
                        lastAppearance[dozen] = index;
                    }
                }
            }
        });
        
        // Encontrar docena caliente y fría
        let hotDozen = 1;
        let maxCount = dozenCounts[1];
        let coldDozen = 1;
        let minCount = dozenCounts[1];
        
        for (let d = 2; d <= 3; d++) {
            if (dozenCounts[d] > maxCount) {
                maxCount = dozenCounts[d];
                hotDozen = d;
            }
            if (dozenCounts[d] < minCount) {
                minCount = dozenCounts[d];
                coldDozen = d;
            }
        }
        
        return {
            hotDozen: hotDozen,
            coldDozen: coldDozen,
            dozenStats: dozenCounts,
            lastAppearance: lastAppearance
        };
    },

    /**
     * REINICIAR EL SISTEMA (Mantener saldo)
     */
    reset: function() {
        const currentBalance = this.state.balance;
        this.init(currentBalance);
        console.log("🔄 Sistema reiniciado");
    },

    // ============================================
    // MÉTODOS PRIVADOS - LÓGICA INTERNA
    // ============================================

    /**
     * VERIFICAR TRANSICIONES DE FASE
     * @private
     */
    _checkPhaseTransitions: function() {
        const historyCount = this.state.history.length;
        
        // CALIBRATION -> GHOST
        if (this.state.phase === 'CALIBRATION' && historyCount >= this.config.calibrationTarget) {
            this.state.phase = 'GHOST';
            this.state.ghostWins = 0;
            this.state.ghostTotal = 0;
            console.log("🎯 TRANSICIÓN: CALIBRATION -> GHOST");
        }
        
        // GHOST -> ACTIVE
        if (this.state.phase === 'GHOST' && this.state.ghostTotal >= this.config.ghostTarget) {
            const accuracy = (this.state.ghostWins / this.state.ghostTotal) * 100;
            
            if (accuracy >= this.config.minAccuracy) {
                this.state.phase = 'ACTIVE';
                this.state.betLevel = 1;
                this.state.currentBet = this._calculateNextBet();
                console.log(`🎯 TRANSICIÓN: GHOST -> ACTIVE (Precisión: ${accuracy.toFixed(1)}%)`);
            } else {
                // No pasa la prueba, reinicia contadores de Ghost
                this.state.ghostTotal = 0;
                this.state.ghostWins = 0;
                console.log(`⏳ GHOST: Precisión insuficiente (${accuracy.toFixed(1)}%). Continuando calibración...`);
            }
        }
        
        // ACTIVE -> PROTECTION
        if (this.state.phase === 'ACTIVE' && 
            this.state.consecutiveLosses >= this.config.maxConsecutiveLosses) {
            this.state.phase = 'PROTECTION';
            console.log("🛡️ TRANSICIÓN: ACTIVE -> PROTECTION (3 pérdidas consecutivas)");
        }
        
        // PROTECTION -> GHOST (después de un acierto)
        if (this.state.phase === 'PROTECTION' && this.state.consecutiveWins > 0) {
            this.state.phase = 'GHOST';
            this.state.ghostTotal = 0;
            this.state.ghostWins = 0;
            this.state.consecutiveLosses = 0;
            console.log("🔄 PROTECTION -> GHOST (Acierto en protección)");
        }
    },

    /**
     * ANALIZAR Y PREDECIR DOCENA
     * @private
     * @returns {object} Predicción
     */
    _analyzeAndPredict: function() {
        // Necesitamos datos suficientes
        if (this.state.history.length < 10) {
            return {
                dozen: null,
                confidence: 0,
                reason: "Recopilando datos...",
                numbers: [],
                hotDozen: null,
                coldDozen: null
            };
        }
        
        const stats = this.getStats();
        const window = this.state.history.slice(0, Math.min(37, this.state.history.length));
        const totalNonZero = window.filter(n => n !== 0).length;
        const expectedPerDozen = totalNonZero / 3;
        
        // Calcular puntuación para cada docena
        let scores = {1: 0, 2: 0, 3: 0};
        
        for (let d = 1; d <= 3; d++) {
            // Factor A: Déficit de frecuencia
            const deficit = expectedPerDozen - stats.dozenStats[d];
            scores[d] += deficit * this.config.dozenWeight;
            
            // Factor B: Retraso (más puntos si hace mucho no sale)
            if (stats.lastAppearance[d] > 5) {
                scores[d] += stats.lastAppearance[d] * this.config.delayWeight;
            }
            
            // Factor C: Penalización por salida reciente
            if (stats.lastAppearance[d] === 0) {
                scores[d] -= 25;
            }
            
            // Factor D: Desviación estándar ponderada
            const deviation = Math.abs(stats.dozenStats[d] - expectedPerDozen) / expectedPerDozen;
            scores[d] += deviation * this.config.deviationWeight;
        }
        
        // Encontrar mejor docena
        let bestDozen = 1;
        let bestScore = scores[1];
        
        for (let d = 2; d <= 3; d++) {
            if (scores[d] > bestScore) {
                bestScore = scores[d];
                bestDozen = d;
            }
        }
        
        // Calcular confianza (40-95%)
        let confidence = 40;
        if (bestScore > 0) {
            const normalizedScore = Math.min(100, bestScore / 2);
            confidence = 40 + (normalizedScore * 0.55);
        }
        confidence = Math.min(95, Math.max(20, Math.round(confidence)));
        
        // Generar números recomendados
        const recommendedNumbers = this._getHotNumbersInDozen(window, bestDozen);
        
        return {
            dozen: bestDozen,
            confidence: confidence,
            reason: `Déficit: ${stats.dozenStats[bestDozen]} vs Esperado: ${Math.round(expectedPerDozen)} | Retraso: ${stats.lastAppearance[bestDozen]} giros`,
            numbers: recommendedNumbers,
            hotDozen: stats.hotDozen,
            coldDozen: stats.coldDozen,
            scores: scores
        };
    },

    /**
     * CALCULAR RESULTADO DE UN TIRO
     * @private
     * @param {number} number - Número que salió
     * @param {object} prediction - Predicción anterior
     * @returns {object} Resultado
     */
    _calculateResult: function(number, prediction) {
        if (!prediction || prediction.dozen === null) {
            return null;
        }
        
        const actualDozen = number === 0 ? 0 : Math.ceil(number / 12);
        const won = (prediction.dozen === actualDozen && actualDozen !== 0);
        
        let amount = 0;
        
        // GHOST MODE: Solo registrar estadísticas
        if (this.state.phase === 'GHOST') {
            this.state.ghostTotal++;
            if (won) this.state.ghostWins++;
            return { won: won, amount: 0, phase: 'GHOST' };
        }
        
        // ACTIVE MODE: Jugar con dinero real
        if (this.state.phase === 'ACTIVE') {
            amount = this.state.currentBet;
            
            if (won) {
                // Ganancia: 2:1 en docenas
                const winAmount = amount * 2;
                this.state.balance += winAmount;
                this.state.consecutiveWins++;
                this.state.consecutiveLosses = 0;
                amount = winAmount;
                
                // D'Alembert: Bajar 1 nivel
                this.state.betLevel = Math.max(1, this.state.betLevel - 1);
            } else {
                // Pérdida
                this.state.balance -= amount;
                this.state.consecutiveLosses++;
                this.state.consecutiveWins = 0;
                amount = -amount;
                
                // D'Alembert: Subir 1 nivel (excepto en cero)
                if (number !== 0) {
                    this.state.betLevel++;
                }
            }
            
            // Actualizar apuesta para próximo tiro
            this.state.currentBet = this._calculateNextBet();
            
            // Guardar en historial de resultados
            this.state.resultHistory.unshift({
                won: won,
                amount: amount,
                bet: this.state.currentBet,
                timestamp: Date.now()
            });
            
            // Limitar historial
            if (this.state.resultHistory.length > 50) {
                this.state.resultHistory.pop();
            }
            
            return { won: won, amount: amount, phase: 'ACTIVE' };
        }
        
        // PROTECTION MODE: Similar a Ghost pero con posibilidad de volver
        if (this.state.phase === 'PROTECTION') {
            if (won) {
                this.state.consecutiveWins++;
                this.state.consecutiveLosses = 0;
            } else {
                this.state.consecutiveLosses++;
                this.state.consecutiveWins = 0;
            }
            return { won: won, amount: 0, phase: 'PROTECTION' };
        }
        
        return null;
    },

    /**
     * CALCULAR SIGUIENTE APUESTA (D'ALEMBERT)
     * @private
     * @returns {number} Monto de la apuesta
     */
    _calculateNextBet: function() {
        // Recalcular tamaño de unidad (1% del saldo actual)
        this.state.unitSize = Math.max(100, this.state.balance * 0.01);
        
        // Calcular apuesta: nivel * unidad
        let calculatedBet = this.state.betLevel * this.state.unitSize;
        
        // Límites de seguridad
        const maxBet = this.state.balance * 0.05; // Máximo 5% del saldo
        const minBet = this.state.unitSize; // Mínimo 1 unidad
        
        if (calculatedBet > maxBet) {
            calculatedBet = maxBet;
        }
        
        if (calculatedBet < minBet) {
            calculatedBet = minBet;
        }
        
        // Asegurar que no apueste más de lo que tiene
        if (calculatedBet > this.state.balance) {
            calculatedBet = this.state.balance;
        }
        
        return Math.round(calculatedBet);
    },

    /**
     * ACTUALIZAR ESTADÍSTICAS
     * @private
     * @param {object} result - Resultado del tiro
     */
    _updateStatistics: function(result) {
        if (!result) return;
        
        // Actualizar estadísticas de Ghost Mode si aplica
        if (this.state.phase === 'GHOST' && result.phase === 'GHOST') {
            this.state.ghostHistory.unshift({
                won: result.won,
                timestamp: Date.now()
            });
            
            // Limitar historial de Ghost
            if (this.state.ghostHistory.length > 20) {
                this.state.ghostHistory.pop();
            }
        }
    },

    /**
     * VERIFICAR GESTIÓN DE RIESGO
     * @private
     */
    _checkRiskManagement: function() {
        // Verificar Stop Loss
        if (this.state.balance <= this.state.stopLoss) {
            console.log("🛑 STOP LOSS ALCANZADO");
            this.state.phase = 'PROTECTION';
        }
        
        // Verificar Profit Target
        if (this.state.balance >= this.state.profitTarget) {
            console.log("🎯 PROFIT TARGET ALCANZADO");
            // Podríamos detener el sistema o celebrar
        }
    },

    /**
     * OBTENER NÚMEROS CALIENTES EN UNA DOCENA
     * @private
     * @param {array} history - Historial de números
     * @param {number} dozen - Docena a analizar
     * @returns {array} Números recomendados
     */
    _getHotNumbersInDozen: function(history, dozen) {
        let numberCounts = {};
        const startNum = (dozen - 1) * 12 + 1;
        const endNum = dozen * 12;
        
        // Contar frecuencia de cada número en la docena
        history.forEach(n => {
            if (n >= startNum && n <= endNum) {
                numberCounts[n] = (numberCounts[n] || 0) + 1;
            }
        });
        
        // Ordenar por frecuencia
        let sortedNumbers = Object.keys(numberCounts)
            .sort((a, b) => numberCounts[b] - numberCounts[a])
            .slice(0, 6)
            .map(Number);
        
        // Si no hay suficientes datos, devolver números de la docena
        if (sortedNumbers.length < 3) {
            let allNumbers = [];
            for (let i = startNum; i <= endNum; i++) {
                allNumbers.push(i);
            }
            // Mezclar y tomar 6
            allNumbers = allNumbers.sort(() => Math.random() - 0.5);
            return allNumbers.slice(0, 6);
        }
        
        return sortedNumbers;
    },

    /**
     * OBTENER ESTADO ACTUAL PARA LA INTERFAZ
     * @private
     * @param {object} lastResult - Último resultado
     * @returns {object} Estado formateado
     */
    _getCurrentState: function(lastResult) {
        return {
            phase: this.state.phase,
            prediction: this.state.currentPrediction,
            bet: this.state.currentBet,
            balance: this.state.balance,
            historyCount: this.state.history.length,
            lastResult: lastResult,
            stats: this.getStats(),
            accuracy: this.getAccuracy()
        };
    }
};

// Exportar para uso global (si es necesario)
if (typeof window !== 'undefined') {
    window.NEON_CORE = NEON_CORE;
}
