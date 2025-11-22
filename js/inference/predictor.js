class Predictor {
    constructor(modelManager, datasetManager) {
        this.modelManager = modelManager;
        this.datasetManager = datasetManager;
        this.isPredicting = false;
    }

    async predictImage(imageDataUrl) {
        if (this.isPredicting) {
            throw new Error('Prediction already in progress');
        }

        this.isPredicting = true;
        
        try {
            const predictions = {};
            const classNames = this.datasetManager.classes.map(c => c.name);

            // Validate input
            if (!imageDataUrl || typeof imageDataUrl !== 'string') {
                throw new Error('Invalid image data URL');
            }

            // Get predictions from all trained models
            for (const [type, model] of Object.entries(this.modelManager.models)) {
                if (model && model.isTrained) {
                    try {
                        const startTime = performance.now();
                        const probabilities = await model.predict(imageDataUrl);
                        const endTime = performance.now();
                        
                        predictions[type] = {
                            predictions: this.formatPredictions(probabilities, classNames),
                            inferenceTime: endTime - startTime
                        };
                    } catch (error) {
                        console.error(`Error predicting with ${type}:`, error);
                        predictions[type] = {
                            predictions: [{ className: 'Prediction Error', probability: 0 }],
                            inferenceTime: 0,
                            error: error.message
                        };
                    }
                } else {
                    predictions[type] = {
                        predictions: [{ className: 'Model not trained', probability: 0 }],
                        inferenceTime: 0
                    };
                }
            }

            return predictions;
        } catch (error) {
            console.error('Error in predictImage:', error);
            throw error;
        } finally {
            this.isPredicting = false;
        }
    }

    formatPredictions(probabilities, classNames) {
        if (!probabilities || !Array.isArray(probabilities)) {
            return [{ className: 'Invalid prediction', probability: 0 }];
        }

        return probabilities
            .map((probability, index) => ({
                className: classNames[index] || `Class ${index}`,
                probability: probability
            }))
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 5); // Return top 5 predictions
    }

    async evaluateAllModels(testData) {
        if (!testData || !testData.images || !testData.labels) {
            throw new Error('Invalid test data');
        }

        const evaluations = {};

        for (const [type, model] of Object.entries(this.modelManager.models)) {
            if (model && model.isTrained) {
                try {
                    console.log(`Evaluating ${type}...`);
                    const evaluation = await model.evaluate(testData.images, testData.labels);
                    evaluations[type] = evaluation;
                    
                    // Update model manager
                    this.modelManager.setEvaluationResults(type, evaluation);
                    
                    console.log(`${type} evaluation:`, evaluation);
                } catch (error) {
                    console.error(`Error evaluating ${type}:`, error);
                    evaluations[type] = { 
                        accuracy: 0, 
                        error: error.message 
                    };
                }
            } else {
                evaluations[type] = { 
                    accuracy: 0, 
                    error: 'Model not trained' 
                };
            }
        }

        return evaluations;
    }

    generateConfusionMatrix(predictions, actualLabels, classNames) {
        if (!predictions || !actualLabels || !classNames) {
            throw new Error('Invalid input for confusion matrix');
        }

        const numClasses = classNames.length;
        const matrix = Array(numClasses).fill().map(() => Array(numClasses).fill(0));

        predictions.forEach((prediction, index) => {
            if (index >= actualLabels.length) return;
            
            const predictedClass = prediction.indexOf(Math.max(...prediction));
            const actualClass = actualLabels[index];
            
            if (actualClass >= 0 && actualClass < numClasses && 
                predictedClass >= 0 && predictedClass < numClasses) {
                matrix[actualClass][predictedClass]++;
            }
        });

        return matrix;
    }

    calculateMetrics(confusionMatrix) {
        if (!confusionMatrix || !Array.isArray(confusionMatrix)) {
            throw new Error('Invalid confusion matrix');
        }

        const numClasses = confusionMatrix.length;
        const metrics = {
            accuracy: 0,
            precision: [],
            recall: [],
            f1Score: [],
            support: []
        };

        let correctPredictions = 0;
        let totalPredictions = 0;

        for (let i = 0; i < numClasses; i++) {
            let truePositives = confusionMatrix[i][i] || 0;
            let falsePositives = 0;
            let falseNegatives = 0;

            for (let j = 0; j < numClasses; j++) {
                if (i !== j) {
                    falsePositives += confusionMatrix[j][i] || 0;
                    falseNegatives += confusionMatrix[i][j] || 0;
                }
            }

            correctPredictions += truePositives;
            totalPredictions += truePositives + falsePositives + falseNegatives;

            const precision = truePositives + falsePositives > 0 ? 
                truePositives / (truePositives + falsePositives) : 0;
            const recall = truePositives + falseNegatives > 0 ? 
                truePositives / (truePositives + falseNegatives) : 0;
            const f1 = precision + recall > 0 ? 
                2 * (precision * recall) / (precision + recall) : 0;

            metrics.precision.push(precision);
            metrics.recall.push(recall);
            metrics.f1Score.push(f1);
            metrics.support.push(truePositives + falseNegatives);
        }

        metrics.accuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
        return metrics;
    }

    // Batch prediction for multiple images
    async predictBatch(imageDataUrls) {
        if (!Array.isArray(imageDataUrls)) {
            throw new Error('Image data URLs must be an array');
        }

        const batchPredictions = [];
        
        for (const imageDataUrl of imageDataUrls) {
            try {
                const prediction = await this.predictImage(imageDataUrl);
                batchPredictions.push(prediction);
            } catch (error) {
                console.error('Error in batch prediction:', error);
                batchPredictions.push({ error: error.message });
            }
        }
        
        return batchPredictions;
    }

    // Get prediction statistics
    getPredictionStats(predictions) {
        const stats = {
            totalModels: 0,
            trainedModels: 0,
            averageConfidence: 0,
            fastestModel: null,
            slowestModel: null
        };

        let totalConfidence = 0;
        let confidenceCount = 0;
        let minTime = Infinity;
        let maxTime = 0;

        for (const [modelType, result] of Object.entries(predictions)) {
            stats.totalModels++;
            
            if (result.predictions && result.predictions[0].probability > 0) {
                stats.trainedModels++;
                
                // Calculate average confidence for top prediction
                if (result.predictions[0].probability > 0) {
                    totalConfidence += result.predictions[0].probability;
                    confidenceCount++;
                }
                
                // Track fastest/slowest models
                if (result.inferenceTime > 0) {
                    if (result.inferenceTime < minTime) {
                        minTime = result.inferenceTime;
                        stats.fastestModel = modelType;
                    }
                    if (result.inferenceTime > maxTime) {
                        maxTime = result.inferenceTime;
                        stats.slowestModel = modelType;
                    }
                }
            }
        }

        stats.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
        return stats;
    }
}