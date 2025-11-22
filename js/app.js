// Main application controller
class TeachableMachineApp {
    constructor() {
        this.datasetManager = new DatasetManager();
        this.modelManager = new ModelManager();
        this.predictor = new Predictor(this.modelManager, this.datasetManager);
        
        this.isInitialized = false;
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Teachable Machine App...');
            
            // Check for TensorFlow.js support
            await this.checkCompatibility();
            
            // Initialize UI components
            this.initializeUI();
            
            // Set up error handling
            this.setupErrorHandling();
            
            this.isInitialized = true;
            console.log('Teachable Machine App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showFatalError('Failed to initialize application: ' + error.message);
        }
    }

    async checkCompatibility() {
        const compatibility = {
            tensorflow: !!window.tf,
            webgl: false,
            fileApi: !!window.FileReader,
            webcam: !!navigator.mediaDevices?.getUserMedia
        };

        // Check WebGL support for TensorFlow.js
        if (window.tf) {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                compatibility.webgl = !!gl;
                
                // Test TensorFlow.js backend
                await tf.ready();
                console.log('TensorFlow.js backend:', tf.getBackend());
            } catch (error) {
                console.warn('WebGL not available:', error);
            }
        }

        // Show warnings for missing features
        if (!compatibility.tensorflow) {
            this.showWarning('TensorFlow.js is not loaded. Some features may not work.');
        }
        if (!compatibility.webgl) {
            this.showWarning('WebGL is not available. Training may be slow or not work.');
        }

        return compatibility;
    }

    initializeUI() {
        try {
            // Initialize UI components
            this.classManagerUI = new ClassManagerUI(this.datasetManager);
            this.trainingUI = new TrainingUI(this.modelManager, this.datasetManager, this.predictor);
            this.webcamUI = new WebcamUI(this.predictor, this.datasetManager);
            
            // Initialize test image upload
            this.initializeTestImageUpload();
            
            // Set up global event listeners
            this.setupGlobalEventListeners();
            
            // Render initial state
            this.classManagerUI.renderClasses();
            
            console.log('UI components initialized successfully');
            
        } catch (error) {
            console.error('Error initializing UI:', error);
            throw new Error('UI initialization failed: ' + error.message);
        }
    }

    initializeTestImageUpload() {
        const uploadInput = document.getElementById('test-image-upload');
        const previewContainer = document.getElementById('uploaded-image-preview');
        
        if (!uploadInput || !previewContainer) {
            console.warn('Test image upload elements not found');
            return;
        }

        uploadInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            try {
                // Validate image
                if (!this.datasetManager.validateImage(file)) {
                    this.showAlert('Invalid image file. Please select a JPEG, PNG, GIF, or WebP image under 5MB.', 'error');
                    return;
                }

                // Display preview
                const imageDataUrl = await this.readFileAsDataURL(file);
                previewContainer.innerHTML = `
                    <img src="${imageDataUrl}" alt="Test image preview" style="max-width: 100%; border-radius: 4px;">
                    <div style="margin-top: 8px; font-size: 12px; color: #666;">Uploaded: ${file.name}</div>
                `;

                // Make prediction
                await this.makePrediction(imageDataUrl);
                
            } catch (error) {
                console.error('Error handling test image:', error);
                this.showAlert('Error processing image: ' + error.message, 'error');
            }
        });
    }

    async makePrediction(imageDataUrl) {
        try {
            // Show loading state
            this.setPredictionLoadingState(true);
            
            const predictions = await this.predictor.predictImage(imageDataUrl);
            this.displayPredictions(predictions);
            
            // Show prediction stats
            const stats = this.predictor.getPredictionStats(predictions);
            console.log('Prediction stats:', stats);
            
        } catch (error) {
            console.error('Error making prediction:', error);
            this.showAlert('Prediction failed: ' + error.message, 'error');
            this.clearPredictions();
        } finally {
            this.setPredictionLoadingState(false);
        }
    }

    displayPredictions(predictions) {
        for (const [modelType, result] of Object.entries(predictions)) {
            const predictionElement = document.getElementById(`${this.getModelId(modelType)}-prediction`);
            if (!predictionElement) continue;

            let html = '';
            
            if (result.error) {
                html = `<div class="prediction-item error">Error: ${result.error}</div>`;
            } else if (result.predictions) {
                result.predictions.forEach((pred, index) => {
                    const confidenceClass = this.getConfidenceClass(pred.probability);
                    const isTopPrediction = index === 0;
                    const percentage = (pred.probability * 100).toFixed(1);
                    
                    html += `
                        <div class="prediction-item ${confidenceClass} ${isTopPrediction ? 'top-prediction' : ''}">
                            <span class="class-name">${this.escapeHtml(pred.className)}</span>
                            <span class="confidence">${percentage}%</span>
                        </div>
                    `;
                });

                // Add inference time if available
                if (result.inferenceTime > 0) {
                    html += `<div class="inference-time">Inference: ${result.inferenceTime.toFixed(0)}ms</div>`;
                }
            } else {
                html = '<div class="prediction-item">No prediction available</div>';
            }

            predictionElement.innerHTML = html;
        }
    }

    setPredictionLoadingState(loading) {
        const predictionOutputs = document.querySelectorAll('.prediction-output');
        predictionOutputs.forEach(element => {
            if (loading) {
                element.innerHTML = '<div class="prediction-item loading">Predicting...</div>';
                element.style.opacity = '0.7';
            } else {
                element.style.opacity = '1';
            }
        });
    }

    clearPredictions() {
        const predictionElements = document.querySelectorAll('.prediction-output');
        predictionElements.forEach(element => {
            element.innerHTML = '<div class="prediction-item">No prediction</div>';
        });
    }

    setupGlobalEventListeners() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        });

        // Handle beforeunload for cleanup
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Handle resize events
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    handlePageHidden() {
        console.log('Page hidden - pausing expensive operations');
        // Webcam will be automatically stopped by the WebcamUI class
    }

    handlePageVisible() {
        console.log('Page visible - resuming operations');
    }

    handleResize() {
        // Update any responsive layouts if needed
        if (this.classManagerUI) {
            this.classManagerUI.renderClasses();
        }
    }

    handleKeyboardShortcuts(event) {
        // Ctrl+Enter to train all models
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            const trainAllBtn = document.getElementById('train-all');
            if (trainAllBtn && !trainAllBtn.disabled) {
                trainAllBtn.click();
            }
        }
        
        // Escape key to cancel operations
        if (event.key === 'Escape') {
            if (this.webcamUI && this.webcamUI.isWebcamActive) {
                this.webcamUI.stopWebcam();
            }
        }
    }

    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showAlert('An unexpected error occurred', 'error');
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showAlert('An operation failed: ' + event.reason.message, 'error');
            event.preventDefault();
        });
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    getModelId(modelType) {
        const modelMap = {
            'logisticRegression': 'lr',
            'randomForest': 'rf',
            'cnn': 'cnn'
        };
        return modelMap[modelType] || modelType;
    }

    getConfidenceClass(probability) {
        if (probability > 0.7) return 'high-confidence';
        if (probability > 0.3) return 'medium-confidence';
        return 'low-confidence';
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.global-alert');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alert = document.createElement('div');
        alert.className = `global-alert alert-${type}`;
        alert.innerHTML = `
            <div class="alert-content">
                <span class="alert-message">${message}</span>
                <button class="alert-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Style the alert
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 0;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ${type === 'error' ? 'background: #e74c3c;' : ''}
            ${type === 'success' ? 'background: #27ae60;' : ''}
            ${type === 'warning' ? 'background: #f39c12;' : ''}
            ${type === 'info' ? 'background: #3498db;' : ''}
        `;

        const alertContent = alert.querySelector('.alert-content');
        alertContent.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
        `;

        const closeBtn = alert.querySelector('.alert-close');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            margin-left: 10px;
        `;

        document.body.appendChild(alert);

        // Auto remove after 5 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.parentNode.removeChild(alert);
                }
            }, 5000);
        }
    }

    showWarning(message) {
        this.showAlert(`Warning: ${message}`, 'warning');
    }

    showFatalError(message) {
        const errorHtml = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(231, 76, 60, 0.95);
                color: white;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 100000;
                padding: 20px;
                text-align: center;
                font-family: Arial, sans-serif;
            ">
                <h1 style="font-size: 24px; margin-bottom: 20px;">Application Error</h1>
                <p style="font-size: 16px; margin-bottom: 30px; max-width: 500px;">${message}</p>
                <button onclick="location.reload()" style="
                    padding: 10px 20px;
                    background: white;
                    color: #e74c3c;
                    border: none;
                    border-radius: 4px;
                    font-size: 16px;
                    cursor: pointer;
                    font-weight: bold;
                ">Reload Application</button>
            </div>
        `;
        
        document.body.innerHTML = errorHtml;
    }

    // Get application status
    getStatus() {
        return {
            initialized: this.isInitialized,
            dataset: {
                classes: this.datasetManager.getClassCount(),
                images: this.datasetManager.getTotalImages(),
                validation: this.datasetManager.validateDataset()
            },
            models: this.modelManager.getTrainingStatus(),
            memory: tf.memory(),
            compatibility: this.checkCompatibility()
        };
    }

    // Export application state
    exportState() {
        const state = {
            dataset: {
                classes: this.datasetManager.classes,
                timestamp: new Date().toISOString()
            },
            models: {
                trained: this.modelManager.getTrainingStatus(),
                evaluations: this.modelManager.getAllEvaluationResults(),
                saved: this.modelManager.getSavedModels()
            },
            version: '1.0'
        };
        
        return JSON.stringify(state, null, 2);
    }

    // Clean up resources
    cleanup() {
        console.log('Cleaning up application resources...');
        
        // Stop webcam
        if (this.webcamUI) {
            this.webcamUI.dispose();
        }
        
        // Clean up models
        if (this.modelManager) {
            this.modelManager.cleanup();
        }
        
        // Clear TensorFlow.js memory
        if (window.tf) {
            tf.disposeVariables();
        }
        
        console.log('Cleanup completed');
    }

    // Reset application
    async reset() {
        if (confirm('Are you sure you want to reset the application? This will delete all classes, images, and models.')) {
            try {
                this.cleanup();
                
                // Reset managers
                this.datasetManager.clearAll();
                this.modelManager.reset();
                
                // Reset UI
                this.classManagerUI.renderClasses();
                this.clearPredictions();
                
                // Clear file inputs
                const fileInputs = document.querySelectorAll('input[type="file"]');
                fileInputs.forEach(input => input.value = '');
                
                // Clear previews
                const previews = document.querySelectorAll('.image-preview');
                previews.forEach(preview => preview.innerHTML = '');
                
                // Reset progress
                this.trainingUI.updateTrainingProgress(0, 'Ready to train');
                
                this.showAlert('Application reset successfully', 'success');
                
            } catch (error) {
                console.error('Error resetting application:', error);
                this.showAlert('Error resetting application: ' + error.message, 'error');
            }
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Show loading state
        document.body.style.opacity = '0.7';
        
        // Initialize app
        window.app = new TeachableMachineApp();
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Hide loading state
        document.body.style.opacity = '1';
        
        console.log('Teachable Machine App ready!');
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        document.body.innerHTML = `
            <div style="
                padding: 40px;
                text-align: center;
                font-family: Arial, sans-serif;
                color: #e74c3c;
            ">
                <h1>Failed to Load Application</h1>
                <p>${error.message}</p>
                <button onclick="location.reload()" style="
                    padding: 10px 20px;
                    background: #e74c3c;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-top: 20px;
                ">Retry</button>
            </div>
        `;
    }
});

// Global utility functions
window.debugApp = function() {
    if (window.app) {
        console.log('App Status:', window.app.getStatus());
        console.log('TensorFlow Memory:', tf.memory());
        console.log('Dataset Summary:', window.app.datasetManager.getDatasetSummary());
    }
};

window.exportAppState = function() {
    if (window.app) {
        const state = window.app.exportState();
        const blob = new Blob([state], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `teachable-machine-backup-${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

window.resetApp = function() {
    if (window.app) {
        window.app.reset();
    }
};