import '../../assets/styles.css';

const Modal = ({ children, onClose }) => {
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button className="modal-close" onClick={onClose}>
                    ?
                </button>
                {children}
            </div>
        </div>
    );
};

export default Modal;
