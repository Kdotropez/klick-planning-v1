import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import '../../assets/styles.css';
import VersionInfo from '../common/VersionInfo.jsx';

const Header = ({ selectedShop, selectedWeek }) => {
    return (
        <header style={{ textAlign: 'center', marginBottom: '20px', fontFamily: 'Roboto, sans-serif', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                <VersionInfo showDetails={false} />
            </div>
            <h1>Planning - {selectedShop || 'Boutique non sélectionnée'}</h1>
            {selectedWeek && (
                <p>Semaine du {format(new Date(selectedWeek), 'd MMMM yyyy', { locale: fr })}</p>
            )}
        </header>
    );
};

export default Header;