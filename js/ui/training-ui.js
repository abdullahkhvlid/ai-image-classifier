class TrainingUI {
    constructor(modelManager, datasetManager, predictor) {
        this.modelManager = modelManager;
        this.datasetManager = datasetManager;
        this.predictor = predictor;
        this.isTraining = false;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('train-all').addEventListener('click', () => this.trainAllModels());
        document.getElementById('train-lr').addEventListener('click', () => this.trainModel('logisticRegression'));
        document.getElementById('train-rf').addEventListener('click', () => this.trainModel('randomForest'));
        document.getElementById('train-cnn').addEventListener('click', () => this.trainModel('cnn'));
    }

    async trainAllModels() {
        if (this.isTraining) {
            this.showAlert('Training already in progress', 'error');
            return;
        }

        const models = ['logisticRegression', 'randomForest', 'cnn'];
        
        for (const modelType of models) {
            if (!this.isTraining) break; // Stop if training was cancelled
            await this.trainModel(modelType);
        }
    }

    async trainModel(modelType) {
        if (this.isTraining) {
            this.showAlert('Training already in progress', 'error');
            return;
        }

        // Validate dataset
        const validation = this.datasetManager.validateDataset();
        if (!validation.isValid) {
            this.showAlert(`Cannot train model: ${validation.errors.join(', ')}`, 'error');
            return;
        }

        this.isTraining = true;
        this.modelManager.setTrainingStatus(true);

        try {
            // Prepare training data
            const trainingData = this.datasetManager.prepareTrainingData();
            
            // Create model instance
            let model;
            switch (modelType) {
                case 'logisticRegression':
                    model = new LogisticRegressionTrainer();
                    break;
                case 'randomForest':
                    model = new RandomForestTrainer();
                    break;
                case 'cnn':
                    model = new CNNTrainer();
                    break;
                default:
                    throw new Error(`Unknown model type: ${modelType}`);
            }

            this.modelManager.setModel(modelType, model);

            // Update UI
            this.updateTrainingProgress(0, `Starting ${this.getModelDisplayName(modelType)} training...`);
            this.disableTrainingButtons(true);

            // Train model
            await model.train(trainingData, (progress, logs) => {
                this.updateTrainingProgress(progress, logs, modelType);
            });

            // Evaluate model
            const evaluation = await model.evaluate(trainingData.images, trainingData.labels);
            this.modelManager.setEvaluationResults(modelType, evaluation);

            // Save model
            this.modelManager.saveModel(modelType);

            // Update UI with results
            this.displayEvaluationResults(modelType, evaluation);
            this.updateTrainingProgress(100, `${this.getModelDisplayName(modelType)} training completed!`);
            
            this.showAlert(`${this.getModelDisplayName(modelType)} trained successfully! Accuracy: ${(evaluation.accuracy * 100).toFixed(1)}%`, 'success');

        } catch (error) {
            console.error(`Error training ${modelType}:`, error);
            this.updateTrainingProgress(0, `Error training ${this.getModelDisplayName(modelType)}: ${error.message}`);
            this.showAlert(`Failed to train ${this.getModelDisplayName(modelType)}: ${error.message}`, 'error');
        } finally {
            this.isTraining = false;
            this.modelManager.setTrainingStatus(false);
            this.disableTrainingButtons(false);
            this.modelManager.cleanup(); // Clean up memory
        }
    }

    updateTrainingProgress(progress, logs, modelType = '') {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const statusElement = document.getElementById('training-status');

        if (progressFill) {
            progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
            progressFill.style.transition = 'width 0.3s ease';
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }

        let statusMessage = '';
        
        if (typeof logs === 'string') {
            statusMessage = logs;
        } else if (logs && logs.stage) {
            const modelName = this.getModelDisplayName(modelType);
            statusMessage = `${modelName}: ${logs.stage.replace('-', ' ')} - ${logs.current}/${logs.total}`;
        } else if (logs && logs.epoch) {
            const modelName = this.getModelDisplayName(modelType);
            const loss = logs.loss ? logs.loss.toFixed(4) : 'N/A';
            const acc = logs.acc ? (logs.acc * 100).toFixed(1) + '%' : 'N/A';
            statusMessage = `${modelName}: Epoch ${logs.epoch} - Loss: ${loss} - Accuracy: ${acc}`;
        } else if (logs && logs.tree) {
            const modelName = this.getModelDisplayName(modelType);
            statusMessage = `${modelName}: Building tree ${logs.tree}/${logs.total || 50}`;
        } else {
            statusMessage = modelType ? `${this.getModelDisplayName(modelType)}: Training in progress...` : 'Training in progress...';
        }

        if (statusElement) {
            statusElement.textContent = statusMessage;
            statusElement.className = this.isTraining ? 'training-status-training' : 'training-status-ready';
        }
    }

    disableTrainingButtons(disabled) {
        const buttons = document.querySelectorAll('.training-controls button');
        buttons.forEach(button => {
            button.disabled = disabled;
            if (disabled) {
                button.style.opacity = '0.6';
                button.style.cursor = 'not-allowed';
            } else {
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
            }
        });
    }

    displayEvaluationResults(modelType, evaluation) {
        const modelId = this.getModelId(modelType);
        const metricsElement = document.getElementById(`${modelId}-metrics`);

        if (!metricsElement) {
            console.warn(`Metrics element not found for ${modelType}`);
            return;
        }

        let metricsHTML = '';
        
        if (evaluation.error) {
            metricsHTML = `<div class="metric error">Error: ${evaluation.error}</div>`;
        } else {
            metricsHTML = `
                <div class="metric">
                    <span>Accuracy:</span>
                    <span>${(evaluation.accuracy * 100).toFixed(2)}%</span>
                </div>
            `;
            
            if (evaluation.loss !== undefined) {
                metricsHTML += `
                    <div class="metric">
                        <span>Loss:</span>
                        <span>${evaluation.loss.toFixed(4)}</span>
                    </div>
                `;
            }
            
            if (evaluation.trees) {
                metricsHTML += `
                    <div class="metric">
                        <span>Trees:</span>
                        <span>${evaluation.trees}</span>
                    </div>
                `;
            }
        }

        metricsElement.innerHTML = metricsHTML;
        metricsElement.className = 'metrics evaluated';
    }

    getModelDisplayName(modelType) {
        const names = {
            logisticRegression: 'Logistic Regression',
            randomForest: 'Random Forest',
            cnn: 'CNN'
        };
        return names[modelType] || modelType;
    }

    getModelId(modelType) {
        const ids = {
            logisticRegression: 'lr',
            randomForest: 'rf',
            cnn: 'cnn'
        };
        return ids[modelType] || modelType;
    }

    showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.training-alert');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alert = document.createElement('div');
        alert.className = `training-alert alert-${type}`;
        alert.textContent = message;
        
        // Style the alert
        alert.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 999;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ${type === 'error' ? 'background: #e74c3c;' : ''}
            ${type === 'success' ? 'background: #27ae60;' : ''}
            ${type === 'info' ? 'background: #3498db;' : ''}
        `;

        document.body.appendChild(alert);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
    }

    // Cancel training
    cancelTraining() {
        if (this.isTraining) {
            this.isTraining = false;
            this.modelManager.setTrainingStatus(false);
            this.updateTrainingProgress(0, 'Training cancelled');
            this.showAlert('Training cancelled', 'info');
        }
    }

    // Get training statistics
    getTrainingStats() {
        const stats = this.modelManager.getStats();
        return {
            ...stats,
            isTraining: this.isTraining,
            datasetSize: this.datasetManager.getTotalImages(),
            classCount: this.datasetManager.getClassCount()
        };
    }
}