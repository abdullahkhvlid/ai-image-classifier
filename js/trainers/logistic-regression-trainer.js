class LogisticRegressionTrainer {
    constructor() {
        this.model = null;
        this.isTrained = false;
        this.trainingHistory = null;
        this.classNames = [];
    }

    async train(dataset, onProgress = null) {
        try {
            if (!dataset || !dataset.images || dataset.images.length === 0) {
                throw new Error('No training data available');
            }

            const numClasses = Math.max(...dataset.labels) + 1;
            this.classNames = Array.from({length: numClasses}, (_, i) => `Class ${i}`);
            
            console.log(`Training Logistic Regression with ${dataset.images.length} images, ${numClasses} classes`);

            // Preprocess images
            const processedImages = await this.preprocessImages(dataset.images);
            
            // Convert to TensorFlow tensors
            const xs = tf.tensor2d(processedImages);
            const ys = tf.oneHot(tf.tensor1d(dataset.labels, 'int32'), numClasses);
            
            // Create and compile model
            this.model = tf.sequential({
                layers: [
                    tf.layers.dense({
                        units: 64, // Reduced for performance
                        activation: 'relu',
                        inputShape: [processedImages[0].length]
                    }),
                    tf.layers.dropout({ rate: 0.3 }),
                    tf.layers.dense({
                        units: numClasses,
                        activation: 'softmax'
                    })
                ]
            });

            this.model.compile({
                optimizer: tf.train.adam(0.001),
                loss: 'categoricalCrossentropy',
                metrics: ['accuracy']
            });

            // Train model with fewer epochs for faster training
            const history = await this.model.fit(xs, ys, {
                epochs: 20,
                batchSize: 16,
                validationSplit: 0.2,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        if (onProgress) {
                            const progress = (epoch + 1) / 20 * 100;
                            onProgress(progress, logs);
                        }
                        console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
                    }
                }
            });

            this.trainingHistory = history;
            this.isTrained = true;

            // Clean up tensors
            xs.dispose();
            ys.dispose();

            console.log('Logistic Regression training completed');
            return history;
        } catch (error) {
            console.error('Error in Logistic Regression training:', error);
            throw error;
        }
    }

    async preprocessImages(images) {
        const processed = [];
        
        for (let i = 0; i < images.length; i++) {
            try {
                const imageDataUrl = images[i];
                const tensor = await this.loadAndPreprocessImage(imageDataUrl);
                const flattened = tensor.flatten();
                const data = await flattened.data();
                processed.push(Array.from(data));
                
                tensor.dispose();
                flattened.dispose();
            } catch (error) {
                console.error(`Error processing image ${i}:`, error);
                // Continue with other images
            }
        }
        
        return processed;
    }

    async loadAndPreprocessImage(imageDataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const tensor = tf.browser.fromPixels(img)
                        .resizeNearestNeighbor([32, 32]) // Smaller for performance
                        .toFloat()
                        .div(255.0);
                    resolve(tensor);
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imageDataUrl;
        });
    }

    async evaluate(testImages, testLabels) {
        if (!this.isTrained) {
            throw new Error('Model not trained yet');
        }

        try {
            const processedImages = await this.preprocessImages(testImages);
            const xs = tf.tensor2d(processedImages);
            const numClasses = this.model.layers[2].units;
            const ys = tf.oneHot(tf.tensor1d(testLabels, 'int32'), numClasses);

            const evaluation = this.model.evaluate(xs, ys);
            const loss = evaluation[0].dataSync()[0];
            const accuracy = evaluation[1].dataSync()[0];

            // Clean up
            xs.dispose();
            ys.dispose();
            evaluation[0].dispose();
            evaluation[1].dispose();

            return {
                accuracy: accuracy,
                loss: loss
            };
        } catch (error) {
            console.error('Error in evaluation:', error);
            throw error;
        }
    }

    async predict(imageDataUrl) {
        if (!this.isTrained) {
            throw new Error('Model not trained yet');
        }

        try {
            const processedImage = await this.preprocessImages([imageDataUrl]);
            const xs = tf.tensor2d(processedImage);
            
            const prediction = this.model.predict(xs);
            const probabilities = await prediction.data();
            
            // Clean up
            xs.dispose();
            prediction.dispose();

            return Array.from(probabilities);
        } catch (error) {
            console.error('Error in prediction:', error);
            throw error;
        }
    }

    saveModel() {
        if (!this.isTrained) {
            throw new Error('Model not trained yet');
        }
        
        return {
            type: 'logistic-regression',
            timestamp: new Date().toISOString(),
            accuracy: this.trainingHistory.history.acc[this.trainingHistory.history.acc.length - 1],
            inputShape: this.model.layers[0].batchInputShape
        };
    }

    dispose() {
        if (this.model) {
            this.model.dispose();
        }
    }
}