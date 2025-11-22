class WebcamUI {
    constructor(predictor, datasetManager) {
        this.predictor = predictor;
        this.datasetManager = datasetManager;
        this.webcam = document.getElementById('webcam');
        this.canvas = document.getElementById('webcam-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.stream = null;
        this.isWebcamActive = false;
        this.predictionInterval = null;
        this.isPredicting = false;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const startWebcamBtn = document.getElementById('start-webcam');
        const captureImageBtn = document.getElementById('capture-image');
        
        if (startWebcamBtn) {
            startWebcamBtn.addEventListener('click', () => this.toggleWebcam());
        }
        
        if (captureImageBtn) {
            captureImageBtn.addEventListener('click', () => this.captureImage());
        }

        // Handle page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isWebcamActive) {
                this.stopWebcam();
            }
        });
    }

    async toggleWebcam() {
        if (this.isWebcamActive) {
            this.stopWebcam();
        } else {
            await this.startWebcam();
        }
    }

    async startWebcam() {
        try {
            // Check if browser supports webcam
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Webcam not supported in this browser');
            }

            // Request webcam access
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                } 
            });
            
            // Set up video element
            this.webcam.srcObject = this.stream;
            this.isWebcamActive = true;
            
            // Update UI
            this.updateWebcamUI(true);
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.webcam.onloadedmetadata = () => {
                    this.webcam.play().then(resolve);
                };
            });

            // Start prediction loop
            this.startPredictionLoop();
            
        } catch (error) {
            console.error('Error accessing webcam:', error);
            this.showAlert(`Could not access webcam: ${error.message}`, 'error');
            this.stopWebcam();
        }
    }

    stopWebcam() {
        // Stop prediction loop
        if (this.predictionInterval) {
            clearInterval(this.predictionInterval);
            this.predictionInterval = null;
        }

        // Stop webcam stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }

        // Reset video element
        this.webcam.srcObject = null;
        this.isWebcamActive = false;
        this.isPredicting = false;

        // Update UI
        this.updateWebcamUI(false);
        
        // Clear predictions
        this.clearPredictions();
    }

    updateWebcamUI(isActive) {
        const startWebcamBtn = document.getElementById('start-webcam');
        const captureImageBtn = document.getElementById('capture-image');
        const webcamContainer = document.getElementById('webcam-container');

        if (startWebcamBtn) {
            startWebcamBtn.textContent = isActive ? 'Stop Webcam' : 'Start Webcam';
            startWebcamBtn.style.background = isActive ? '#e74c3c' : '#9b59b6';
        }

        if (captureImageBtn) {
            captureImageBtn.disabled = !isActive;
        }

        if (webcamContainer) {
            webcamContainer.style.display = isActive ? 'block' : 'none';
        }
    }

    startPredictionLoop() {
        if (!this.isWebcamActive) return;

        // Clear any existing interval
        if (this.predictionInterval) {
            clearInterval(this.predictionInterval);
        }

        // Start new prediction loop (every 2 seconds for performance)
        this.predictionInterval = setInterval(async () => {
            if (this.isWebcamActive && !this.isPredicting) {
                await this.captureAndPredict();
            }
        }, 2000);
    }

    async captureAndPredict() {
        if (!this.isWebcamActive || this.isPredicting) return;

        this.isPredicting = true;

        try {
            // Set canvas size to match video
            this.canvas.width = this.webcam.videoWidth;
            this.canvas.height = this.webcam.videoHeight;
            
            // Draw current video frame to canvas
            this.ctx.drawImage(this.webcam, 0, 0, this.canvas.width, this.canvas.height);
            
            // Convert to data URL
            const imageDataUrl = this.canvas.toDataURL('image/jpeg', 0.8);
            
            // Make prediction
            await this.predictImage(imageDataUrl);
            
        } catch (error) {
            console.error('Error in webcam prediction:', error);
        } finally {
            this.isPredicting = false;
        }
    }

    captureImage() {
        if (!this.isWebcamActive) {
            this.showAlert('Webcam is not active', 'error');
            return;
        }

        // Set canvas size to match video
        this.canvas.width = this.webcam.videoWidth;
        this.canvas.height = this.webcam.videoHeight;
        
        // Draw current video frame to canvas
        this.ctx.drawImage(this.webcam, 0, 0, this.canvas.width, this.canvas.height);
        
        // Convert to data URL
        const imageDataUrl = this.canvas.toDataURL('image/png');
        
        // Show preview
        this.showCapturedImage(imageDataUrl);
        
        // Make prediction
        this.predictImage(imageDataUrl);
        
        this.showAlert('Image captured successfully', 'success');
    }

    showCapturedImage(imageDataUrl) {
        const previewContainer = document.getElementById('uploaded-image-preview');
        if (previewContainer) {
            previewContainer.innerHTML = `
                <img src="${imageDataUrl}" alt="Captured image" style="max-width: 100%; border-radius: 4px;">
                <div style="margin-top: 8px; font-size: 12px; color: #666;">Captured from webcam</div>
            `;
        }
    }

    async predictImage(imageDataUrl) {
        try {
            const predictions = await this.predictor.predictImage(imageDataUrl);
            this.displayPredictions(predictions);
        } catch (error) {
            console.error('Error predicting image:', error);
            this.showAlert(`Prediction error: ${error.message}`, 'error');
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
                    
                    html += `
                        <div class="prediction-item ${confidenceClass} ${isTopPrediction ? 'top-prediction' : ''}">
                            <span>${this.escapeHtml(pred.className)}</span>
                            <span>${(pred.probability * 100).toFixed(1)}%</span>
                        </div>
                    `;
                });

                // Add inference time if available
                if (result.inferenceTime > 0) {
                    html += `<div class="inference-time">Time: ${result.inferenceTime.toFixed(0)}ms</div>`;
                }
            } else {
                html = '<div class="prediction-item">No prediction available</div>';
            }

            predictionElement.innerHTML = html;
        }
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

    clearPredictions() {
        const predictionElements = document.querySelectorAll('.prediction-output');
        predictionElements.forEach(element => {
            element.innerHTML = '<div class="prediction-item">No prediction</div>';
        });
    }

    showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.webcam-alert');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alert = document.createElement('div');
        alert.className = `webcam-alert alert-${type}`;
        alert.textContent = message;
        
        // Style the alert
        alert.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 16px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 999;
            max-width: 300px;
            font-size: 14px;
            ${type === 'error' ? 'background: #e74c3c;' : ''}
            ${type === 'success' ? 'background: #27ae60;' : ''}
            ${type === 'info' ? 'background: #3498db;' : ''}
        `;

        document.body.appendChild(alert);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 3000);
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Clean up resources
    dispose() {
        this.stopWebcam();
        
        // Clear any remaining timeouts/intervals
        if (this.predictionInterval) {
            clearInterval(this.predictionInterval);
            this.predictionInterval = null;
        }
    }
}