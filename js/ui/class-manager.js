class ClassManagerUI {
    constructor(datasetManager) {
        this.datasetManager = datasetManager;
        this.classesContainer = document.getElementById('classes-container');
        this.classNameInput = document.getElementById('class-name');
        this.addClassButton = document.getElementById('add-class');
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.addClassButton.addEventListener('click', () => this.addClass());
        this.classNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addClass();
            }
        });
    }

    addClass() {
        const className = this.classNameInput.value.trim();
        
        if (!className) {
            this.showAlert('Please enter a class name', 'error');
            return;
        }

        // Validate class name
        if (className.length > 50) {
            this.showAlert('Class name too long (max 50 characters)', 'error');
            return;
        }

        // Check for special characters
        const invalidChars = /[<>:"/\\|?*]/.test(className);
        if (invalidChars) {
            this.showAlert('Class name contains invalid characters', 'error');
            return;
        }

        try {
            this.datasetManager.addClass(className);
            this.classNameInput.value = '';
            this.renderClasses();
            this.showAlert(`Class "${className}" added successfully`, 'success');
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    deleteClass(className) {
        if (confirm(`Are you sure you want to delete class "${className}" and all its images?`)) {
            const success = this.datasetManager.deleteClass(className);
            if (success) {
                this.renderClasses();
                this.showAlert(`Class "${className}" deleted`, 'success');
            } else {
                this.showAlert(`Class "${className}" not found`, 'error');
            }
        }
    }

    renderClasses() {
        if (!this.classesContainer) {
            console.error('Classes container not found');
            return;
        }

        this.classesContainer.innerHTML = '';
        
        if (this.datasetManager.classes.length === 0) {
            this.classesContainer.innerHTML = `
                <div class="empty-state">
                    <p>No classes created yet. Add your first class above.</p>
                </div>
            `;
            return;
        }
        
        this.datasetManager.classes.forEach(classObj => {
            const classCard = this.createClassCard(classObj);
            this.classesContainer.appendChild(classCard);
        });

        this.updateTrainingButtons();
    }

    createClassCard(classObj) {
        const card = document.createElement('div');
        card.className = 'class-card';
        card.dataset.className = classObj.name;
        
        card.innerHTML = `
            <div class="class-header">
                <span class="class-name">${this.escapeHtml(classObj.name)}</span>
                <button class="delete-class" data-class="${this.escapeHtml(classObj.name)}" 
                        title="Delete class">
                    ×
                </button>
            </div>
            <div class="image-upload">
                <input type="file" accept="image/*" multiple 
                       data-class="${this.escapeHtml(classObj.name)}" class="image-input"
                       title="Upload images for ${this.escapeHtml(classObj.name)}">
                <div class="image-count">Images: ${classObj.images.length}</div>
                ${classObj.images.length < 5 ? 
                  `<div class="warning">Minimum 5 images recommended</div>` : ''}
            </div>
            <div class="class-images" id="images-${this.escapeHtml(classObj.name)}"></div>
        `;

        // Add event listeners
        const deleteButton = card.querySelector('.delete-class');
        deleteButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.deleteClass(classObj.name);
        });

        const imageInput = card.querySelector('.image-input');
        imageInput.addEventListener('change', (e) => {
            e.preventDefault();
            this.handleImageUpload(e, classObj.name);
        });

        // Render existing images
        this.renderClassImages(classObj);

        return card;
    }

    async handleImageUpload(event, className) {
        const files = Array.from(event.target.files);
        
        if (files.length === 0) return;

        let successCount = 0;
        let errorCount = 0;

        for (const file of files) {
            try {
                await this.datasetManager.addImageToClass(className, file);
                successCount++;
                
                // Update progress
                this.updateUploadProgress(className, successCount, files.length);
                
            } catch (error) {
                console.error(`Error uploading ${file.name}:`, error);
                errorCount++;
                this.showAlert(`Error uploading ${file.name}: ${error.message}`, 'error');
            }
        }

        // Final update
        this.renderClassImages(this.datasetManager.classes.find(c => c.name === className));
        this.updateTrainingButtons();
        
        if (successCount > 0) {
            this.showAlert(`Successfully uploaded ${successCount} image(s) to ${className}`, 'success');
        }
        if (errorCount > 0) {
            this.showAlert(`Failed to upload ${errorCount} image(s)`, 'error');
        }
        
        event.target.value = ''; // Reset input
    }

    updateUploadProgress(className, current, total) {
        const classCard = document.querySelector(`[data-class-name="${className}"]`);
        if (!classCard) return;

        const imageCount = classCard.querySelector('.image-count');
        if (imageCount) {
            const classObj = this.datasetManager.classes.find(c => c.name === className);
            if (classObj) {
                imageCount.textContent = `Images: ${classObj.images.length} (Uploading: ${current}/${total})`;
            }
        }
    }

    renderClassImages(classObj) {
        const containerId = `images-${this.escapeHtml(classObj.name)}`;
        const container = document.getElementById(containerId);
        
        if (!container) {
            console.warn(`Container not found: ${containerId}`);
            return;
        }

        container.innerHTML = '';
        
        if (classObj.images.length === 0) {
            container.innerHTML = '<div class="no-images">No images uploaded yet</div>';
            return;
        }

        // Show first 10 images as preview
        const imagesToShow = classObj.images.slice(0, 10);
        
        imagesToShow.forEach(image => {
            const imgElement = document.createElement('img');
            imgElement.className = 'class-image';
            imgElement.src = image.dataUrl;
            imgElement.alt = `Image for ${this.escapeHtml(classObj.name)}`;
            imgElement.title = `Image ${image.id + 1}`;
            imgElement.loading = 'lazy'; // Lazy loading for performance
            
            container.appendChild(imgElement);
        });

        // Show count if more than 10 images
        if (classObj.images.length > 10) {
            const moreText = document.createElement('div');
            moreText.className = 'more-images';
            moreText.textContent = `+${classObj.images.length - 10} more`;
            container.appendChild(moreText);
        }

        // Update image count in header
        this.updateImageCount(classObj.name);
    }

    updateImageCount(className) {
        const classCard = document.querySelector(`[data-class-name="${className}"]`);
        if (!classCard) return;

        const imageCount = classCard.querySelector('.image-count');
        const classObj = this.datasetManager.classes.find(c => c.name === className);
        
        if (imageCount && classObj) {
            imageCount.textContent = `Images: ${classObj.images.length}`;
            
            // Update warning
            const warning = classCard.querySelector('.warning');
            if (warning) {
                if (classObj.images.length >= 5) {
                    warning.style.display = 'none';
                } else {
                    warning.style.display = 'block';
                }
            }
        }
    }

    updateTrainingButtons() {
        const validation = this.datasetManager.validateDataset();
        const trainingButtons = document.querySelectorAll('.training-controls button');
        const statusElement = document.getElementById('training-status');
        
        if (!statusElement) return;

        trainingButtons.forEach(button => {
            if (button.id !== 'train-all') {
                button.disabled = !validation.isValid;
            }
        });

        // Update status message
        if (!validation.isValid) {
            statusElement.textContent = `Training disabled: ${validation.errors.join(', ')}`;
            statusElement.className = 'training-status-error';
        } else {
            const totalImages = this.datasetManager.getTotalImages();
            const classCount = this.datasetManager.getClassCount();
            statusElement.textContent = `Ready to train (${classCount} classes, ${totalImages} images)`;
            statusElement.className = 'training-status-ready';
        }
    }

    showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.alert-message');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alert = document.createElement('div');
        alert.className = `alert-message alert-${type}`;
        alert.textContent = message;
        
        // Style the alert
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            max-width: 300px;
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

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    getDatasetSummary() {
        return {
            totalClasses: this.datasetManager.getClassCount(),
            totalImages: this.datasetManager.getTotalImages(),
            classDistribution: this.datasetManager.getClassDistribution(),
            validation: this.datasetManager.validateDataset()
        };
    }

    // Export dataset for backup
    exportDataset() {
        const dataset = {
            classes: this.datasetManager.classes,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(dataset, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `image-dataset-${new Date().getTime()}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }

    // Import dataset from backup
    async importDataset(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const dataset = JSON.parse(e.target.result);
                    
                    // Validate dataset structure
                    if (!dataset.classes || !Array.isArray(dataset.classes)) {
                        throw new Error('Invalid dataset format');
                    }
                    
                    // Clear current dataset
                    this.datasetManager.clearAll();
                    
                    // Import classes and images
                    dataset.classes.forEach(classData => {
                        this.datasetManager.addClass(classData.name);
                        // Note: Image files can't be restored from JSON backup
                        // This would need server-side storage
                    });
                    
                    this.renderClasses();
                    this.showAlert('Dataset imported successfully', 'success');
                    resolve();
                } catch (error) {
                    reject(new Error('Failed to import dataset: ' + error.message));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
}