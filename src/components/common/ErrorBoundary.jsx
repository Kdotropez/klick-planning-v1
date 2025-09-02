import { Component } from 'react';
import '../../assets/styles.css';

class ErrorBoundary extends Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Erreur capturée par ErrorBoundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-container">
                    <h2>Une erreur s’est produite.</h2>
                    <p>Veuillez réessayer ou contacter le support.</p>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
