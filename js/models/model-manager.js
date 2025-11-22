class ModelManager {
    constructor() {
        this.models = {
            logisticRegression: null,
            randomForest: null,
            cnn: null
        };
        this.evaluationResults = {};
        this.savedModels = [];
        this.isTraining = false;
    }

    setModel(type, model) {
        // Validate input
        if (!['logisticRegression', 'randomForest', 'cnn'].includes(type)) {
            throw new Error(`Invalid model type: ${type}`);
        }
        
        // Dispose old model if exists
        if (this.models[type] && this.models[type].dispose) {
            this.models[type].dispose();
        }
        
        this.models[type] = model;
    }

    getModel(type) {
        if (!['logisticRegression', 'randomForest', 'cnn'].includes(type)) {
            throw new Error(`Invalid model type: ${type}`);
        }
        return this.models[type];
    }

    isModelTrained(type) {
        if (!['logisticRegression', 'randomForest', 'cnn'].includes(type)) {
            return false;
        }
        return this.models[type] && this.models[type].isTrained === true;
    }

    setEvaluationResults(type, results) {
        if (!['logisticRegression', 'randomForest', 'cnn'].includes(type)) {
            throw new Error(`Invalid model type: ${type}`);
        }
        this.evaluationResults[type] = results;
    }

    getEvaluationResults(type) {
        if (!['logisticRegression', 'randomForest', 'cnn'].includes(type)) {
            throw new Error(`Invalid model type: ${type}`);
        }
        return this.evaluationResults[type] || null;
    }

    getAllEvaluationResults() {
        return { ...this.evaluationResults }; // Return copy
    }

    saveModel(type) {
        if (!this.isModelTrained(type)) {
            throw new Error(`Model ${type} is not trained`);
        }

        const modelInfo = this.models[type].saveModel();
        modelInfo.id = this.savedModels.length;
        this.savedModels.push(modelInfo);
        
        console.log(`Model ${type} saved:`, modelInfo);
        return modelInfo;
    }

    getSavedModels() {
        return [...this.savedModels]; // Return copy
    }

    getTrainingStatus() {
        const status = {};
        for (const type of ['logisticRegression', 'randomForest', 'cnn']) {
            status[type] = this.isModelTrained(type);
        }
        return status;
    }

    getTrainedModelsCount() {
        return Object.values(this.getTrainingStatus()).filter(Boolean).length;
    }

    setTrainingStatus(training) {
        this.isTraining = training;
    }

    isAnyModelTraining() {
        return this.isTraining;
    }

    reset() {
        // Dispose all models
        for (const [type, model] of Object.entries(this.models)) {
            if (model && model.dispose) {
                model.dispose();
            }
        }
        
        this.models = {
            logisticRegression: null,
            randomForest: null,
            cnn: null
        };
        this.evaluationResults = {};
        this.isTraining = false;
        
        console.log('Model manager reset');
    }

    // Memory management
    cleanup() {
        tf.tidy(() => {
            // Clean up any temporary tensors
        });
        
        if (tf.memory().numTensors > 100) {
            console.warn(`High tensor count: ${tf.memory().numTensors}. Forcing cleanup.`);
            tf.engine().startScope();
            tf.engine().endScope();
        }
    }

    // Get model statistics
    getStats() {
        const stats = {
            trainedModels: this.getTrainedModelsCount(),
            savedModels: this.savedModels.length,
            memoryUsage: tf.memory(),
            evaluationResults: this.getAllEvaluationResults()
        };
        
        return stats;
    }
}