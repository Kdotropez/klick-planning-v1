import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import '../../assets/styles.css';

const Header = ({ selectedShop, selectedWeek }) => {
    return (
        <header style={{ textAlign: 'center', marginBottom: '20px', fontFamily: 'Roboto, sans-serif' }}>
            <h1>Planning - {selectedShop || 'Boutique non sélectionnée'}</h1>
            {selectedWeek && (
                <p>Semaine du {format(new Date(selectedWeek), 'd MMMM yyyy', { locale: fr })}</p>
            )}
        </header>
    );
};

export default Header;