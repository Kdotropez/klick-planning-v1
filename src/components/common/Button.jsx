import '../../assets/styles.css';

const Button = ({ className, onClick, children, text, style, disabled }) => {
    return (
        <button
            className={`button-base ${className || ''}`}
            onClick={onClick || (() => {})}
            style={style || {}}
            disabled={disabled || false}
        >
            {children || text}
        </button>
    );
};

export default Button;
