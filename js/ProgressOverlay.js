export const progressOverlay = {
    element: null,
    textElement: null,

    init() {
        this.element = document.getElementById('progress-overlay');
        this.textElement = this.element.querySelector('.progress-text');
    },

    show(message = 'Loading...') {
        this.textElement.textContent = message;
        this.element.classList.add('active');
    },

    update(message = 'Loading...') {
        if (this.textElement) {
            this.textElement.textContent = message;
        }
    },

    hide() {
        this.element.classList.remove('active');
    }
};
