import React, { useState, useEffect } from 'react';
import { productsDatabase, searchProducts, getProductByEAN, getCategories } from "../data/productsDatabase";

const CashRegisterApp = ({ onBackToMain }) => {
  // États principaux
  const [activeTab, setActiveTab] = useState('sales');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('products');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filteredProducts, setFilteredProducts] = useState(productsDatabase);
  const [cart, setCart] = useState([]);
  
  // États de paiement
  const [paymentHistory, setPaymentHistory] = useState(() => {
    const saved = localStorage.getItem('paymentHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [paymentMode, setPaymentMode] = useState('cash');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  
  // États de compteurs
  const [dailySalesCount, setDailySalesCount] = useState(() => {
    const saved = localStorage.getItem('dailySalesCount');
    return saved ? JSON.parse(saved) : {};
  });
  const [productSalesCount, setProductSalesCount] = useState(() => {
    const saved = localStorage.getItem('productSalesCount');
    return saved ? JSON.parse(saved) : {};
  });
  
  // États de modification de prix
  const [showPriceEditModal, setShowPriceEditModal] = useState(false);
  const [selectedItemForPriceEdit, setSelectedItemForPriceEdit] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  
  // États de retours
  const [returnMode, setReturnMode] = useState('spontaneous'); // 'spontaneous' ou 'existing'
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnHistory, setReturnHistory] = useState(() => {
    const saved = localStorage.getItem('returnHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [showReturnDetails, setShowReturnDetails] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [returnProductSearch, setReturnProductSearch] = useState('');
  const [returnFilteredProducts, setReturnFilteredProducts] = useState(productsDatabase);
  const [returnPaymentMode, setReturnPaymentMode] = useState('cash');
  const [returnAmountReceived, setReturnAmountReceived] = useState('');
  const [returnChange, setReturnChange] = useState(0);
  const [isProcessingReturnPayment, setIsProcessingReturnPayment] = useState(false);
  
  // États de rapports
  const [dailyReports, setDailyReports] = useState(() => {
    const saved = localStorage.getItem('dailyReports');
    return saved ? JSON.parse(saved) : [];
  });
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [cumulativeView, setCumulativeView] = useState(false);
  const [cumulativeReport, setCumulativeReport] = useState(null);
  const [zNumber, setZNumber] = useState(() => {
    const saved = localStorage.getItem('zNumber');
    return saved ? parseInt(saved) : 1;
  });
  const [showZConfirmation, setShowZConfirmation] = useState(false);

  // Sauvegarder les données dans localStorage
  useEffect(() => {
    localStorage.setItem('paymentHistory', JSON.stringify(paymentHistory));
  }, [paymentHistory]);

  useEffect(() => {
    localStorage.setItem('dailySalesCount', JSON.stringify(dailySalesCount));
  }, [dailySalesCount]);

  useEffect(() => {
    localStorage.setItem('productSalesCount', JSON.stringify(productSalesCount));
  }, [productSalesCount]);

  useEffect(() => {
    localStorage.setItem('returnHistory', JSON.stringify(returnHistory));
  }, [returnHistory]);

  useEffect(() => {
    localStorage.setItem('dailyReports', JSON.stringify(dailyReports));
  }, [dailyReports]);

  useEffect(() => {
    localStorage.setItem('zNumber', zNumber.toString());
  }, [zNumber]);

  // Reset quotidien des compteurs
  useEffect(() => {
    const checkDailyReset = () => {
      const today = new Date().toDateString();
      const lastReset = localStorage.getItem('lastDailyReset');
      
      if (lastReset !== today) {
        setDailySalesCount({});
        setProductSalesCount({});
        localStorage.setItem('lastDailyReset', today);
      }
    };

    checkDailyReset();
    const interval = setInterval(checkDailyReset, 60000); // Vérifier toutes les minutes
    return () => clearInterval(interval);
  }, []);

  // Filtrer les produits pour les retours
  useEffect(() => {
    if (returnProductSearch.trim() === '') {
      setReturnFilteredProducts(productsDatabase);
    } else {
      const results = searchProducts(returnProductSearch);
      setReturnFilteredProducts(results);
    }
  }, [returnProductSearch]);

  // Calculer le change pour les retours
  useEffect(() => {
    const returnTotal = returnItems.reduce((total, item) => total + ((item.finalPrice || item.price) * item.quantity), 0);
    const amountReceived = parseFloat(returnAmountReceived) || 0;
    setReturnChange(amountReceived - returnTotal);
  }, [returnItems, returnAmountReceived]);

  // Filtrer les produits
  useEffect(() => {
    if (searchTerm.trim() === '') {
      if (selectedCategory) {
        setFilteredProducts(productsDatabase.filter(p => p.category === selectedCategory));
      } else {
        setFilteredProducts(productsDatabase);
      }
    } else {
      const results = searchProducts(searchTerm);
      if (selectedCategory) {
        setFilteredProducts(results.filter(p => p.category === selectedCategory));
      } else {
        setFilteredProducts(results);
      }
    }
  }, [searchTerm, selectedCategory]);

  const addToCart = (product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(prevCart =>
        prevCart.map(item =>
          item.id === productId
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    }
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((total, item) => total + ((item.finalPrice || item.price) * item.quantity), 0);
  const cartTotalHT = cartTotal / 1.2; // TVA 20%
  const cartTVA = cartTotal - cartTotalHT;

  const processPayment = () => {
    if (cart.length === 0) return;

    const payment = {
      id: Date.now(),
      items: [...cart],
      total: cartTotal,
      paymentMode,
      timestamp: new Date().toISOString(),
      amountReceived: cartTotal,
      change: 0
    };

    setPaymentHistory(prev => [...prev, payment]);

    // Mettre à jour les compteurs
    setDailySalesCount(prev => {
      const newCount = { ...prev };
      cart.forEach(item => {
        newCount[item.id] = (newCount[item.id] || 0) + item.quantity;
      });
      return newCount;
    });

    setProductSalesCount(prev => {
      const newCount = { ...prev };
      cart.forEach(item => {
        newCount[item.id] = (newCount[item.id] || 0) + item.quantity;
      });
      return newCount;
    });

    clearCart();
    setIsProcessingPayment(false);
  };

  // Fonctions de modification de prix
  const openPriceEditModal = (item) => {
    setSelectedItemForPriceEdit(item);
    setNewPrice(item.price.toString());
    setDiscountPercentage('');
    setShowPriceEditModal(true);
  };

  const closePriceEditModal = () => {
    setShowPriceEditModal(false);
    setSelectedItemForPriceEdit(null);
    setNewPrice('');
    setDiscountPercentage('');
  };

  const applyPriceModification = () => {
    if (!selectedItemForPriceEdit) return;

    const newPriceValue = parseFloat(newPrice);
    const discountValue = parseFloat(discountPercentage);

    if (isNaN(newPriceValue) || newPriceValue < 0) {
      alert('Prix invalide');
      return;
    }

    if (discountValue && (isNaN(discountValue) || discountValue < 0 || discountValue > 100)) {
      alert('Remise invalide (0-100%)');
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.id === selectedItemForPriceEdit.id
          ? {
              ...item,
              originalPrice: item.originalPrice || item.price,
              price: newPriceValue,
              discountPercentage: discountValue || 0,
              discountAmount: discountValue ? (item.originalPrice || item.price) * (discountValue / 100) : 0,
              finalPrice: discountValue ? newPriceValue * (1 - discountValue / 100) : newPriceValue
            }
          : item
      )
    );

    closePriceEditModal();
  };

  const applyDiscount = (itemId, discountPercent) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === itemId
          ? {
              ...item,
              originalPrice: item.originalPrice || item.price,
              discountPercentage: discountPercent,
              discountAmount: (item.originalPrice || item.price) * (discountPercent / 100),
              finalPrice: (item.originalPrice || item.price) * (1 - discountPercent / 100)
            }
          : item
      )
    );
  };

  // Fonctions de retours
  const addItemToReturn = (item, quantity = 1) => {
    setReturnItems(prev => {
      const existingItem = prev.find(returnItem => returnItem.id === item.id);
      if (existingItem) {
        return prev.map(returnItem =>
          returnItem.id === item.id
            ? { ...returnItem, quantity: returnItem.quantity + quantity }
            : returnItem
        );
      } else {
        return [...prev, {
          ...item,
          quantity,
          originalPrice: item.originalPrice || item.price,
          finalPrice: item.finalPrice || item.price
        }];
      }
    });
  };

  const removeItemFromReturn = (itemId) => {
    setReturnItems(prev => prev.filter(item => item.id !== itemId));
  };

  const updateReturnQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeItemFromReturn(itemId);
    } else {
      setReturnItems(prev =>
        prev.map(item =>
          item.id === itemId
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    }
  };

  const processReturn = () => {
    if (returnItems.length === 0) return;

    const returnTotal = returnItems.reduce((total, item) => total + ((item.finalPrice || item.price) * item.quantity), 0);
    const amountReceived = parseFloat(returnAmountReceived) || 0;

    const returnRecord = {
      id: Date.now(),
      items: [...returnItems],
      totalAmount: returnTotal,
      paymentMode: returnPaymentMode,
      amountReceived,
      change: returnChange,
      timestamp: new Date().toISOString(),
      type: returnMode,
      originalSaleId: selectedSaleForReturn?.id || null
    };

    setReturnHistory(prev => [...prev, returnRecord]);

    // Mettre à jour les compteurs (décrémenter)
    setDailySalesCount(prev => {
      const newCount = { ...prev };
      returnItems.forEach(item => {
        if (!newCount[item.id]) newCount[item.id] = 0;
        newCount[item.id] -= item.quantity;
      });
      return newCount;
    });

    setProductSalesCount(prev => {
      const newCount = { ...prev };
      returnItems.forEach(item => {
        if (!newCount[item.id]) newCount[item.id] = 0;
        newCount[item.id] -= item.quantity;
      });
      return newCount;
    });

    // Ajouter le retour à l'historique des paiements avec un montant négatif
    const returnPayment = {
      id: Date.now() + 1,
      items: returnItems.map(item => ({ ...item, price: -item.finalPrice })),
      total: -returnTotal,
      paymentMode: returnPaymentMode,
      timestamp: new Date().toISOString(),
      amountReceived: amountReceived,
      change: returnChange,
      isReturn: true
    };

    setPaymentHistory(prev => [...prev, returnPayment]);

    setReturnItems([]);
    setSelectedSaleForReturn(null);
    setReturnAmountReceived('');
    setIsProcessingReturnPayment(false);
  };

  // Fonctions de rapports
  const calculateDailyReport = () => {
    const today = new Date().toDateString();
    const todayPayments = paymentHistory.filter(payment => 
      new Date(payment.timestamp).toDateString() === today
    );
    const todayReturns = returnHistory.filter(returnRecord => 
      new Date(returnRecord.timestamp).toDateString() === today
    );

    const totalSales = todayPayments
      .filter(p => !p.isReturn)
      .reduce((sum, p) => sum + (p.total || 0), 0);
    
    const totalReturns = todayReturns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    
    const netRevenue = totalSales - totalReturns;
    
    const paymentMethods = {};
    todayPayments.forEach(payment => {
      const method = payment.paymentMode;
      paymentMethods[method] = (paymentMethods[method] || 0) + (payment.total || 0);
    });

    const productVolume = {};
    todayPayments
      .filter(p => !p.isReturn)
      .forEach(payment => {
        payment.items.forEach(item => {
          productVolume[item.id] = (productVolume[item.id] || 0) + item.quantity;
        });
      });

    return {
      date: today,
      totalSales,
      totalReturns,
      netRevenue,
      paymentMethods,
      productVolume,
      transactionCount: todayPayments.length,
      returnCount: todayReturns.length
    };
  };

  const calculateCumulativeReport = () => {
    const allPayments = paymentHistory;
    const allReturns = returnHistory;

    const totalSales = allPayments
      .filter(p => !p.isReturn)
      .reduce((sum, p) => sum + (p.total || 0), 0);
    
    const totalReturns = allReturns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    
    const netRevenue = totalSales - totalReturns;
    
    const paymentMethods = {};
    allPayments.forEach(payment => {
      const method = payment.paymentMode;
      paymentMethods[method] = (paymentMethods[method] || 0) + (payment.total || 0);
    });

    const productVolume = {};
    allPayments
      .filter(p => !p.isReturn)
      .forEach(payment => {
        payment.items.forEach(item => {
          productVolume[item.id] = (productVolume[item.id] || 0) + item.quantity;
        });
      });

    return {
      totalSales,
      totalReturns,
      netRevenue,
      paymentMethods,
      productVolume,
      transactionCount: allPayments.length,
      returnCount: allReturns.length
    };
  };

  const saveDailyReport = () => {
    const report = calculateDailyReport();
    setDailyReports(prev => [...prev, report]);
  };

  const showReportDetailsModal = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  const closeReportModal = () => {
    setShowReportModal(false);
    setSelectedReport(null);
  };

  const exportReportToCSV = (report) => {
    const csvContent = '\uFEFF' + // UTF-8 BOM
      'Date,Rapport Quotidien\n' +
      `${report.date},Z-${zNumber}\n\n` +
      'Résumé Financier\n' +
      `Ventes totales,${(report.totalSales || 0).toFixed(2)}€\n` +
      `Retours totaux,${(report.totalReturns || 0).toFixed(2)}€\n` +
      `Revenu net,${(report.netRevenue || 0).toFixed(2)}€\n\n` +
      'Modes de Paiement\n' +
      Object.entries(report.paymentMethods).map(([method, amount]) => 
        `${method},${(amount || 0).toFixed(2)}€`
      ).join('\n') + '\n\n' +
      'Volume des Articles\n' +
      Object.entries(report.productVolume).map(([productId, quantity]) => {
        const product = productsDatabase.find(p => p.id === productId);
        return `${product ? product.name : productId},${quantity}`;
      }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport_quotidien_${report.date.replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCumulativeReportToCSV = (report) => {
    const csvContent = '\uFEFF' + // UTF-8 BOM
      'Rapport Cumulatif\n' +
      `Nombre de transactions,${report.transactionCount}\n` +
      `Nombre de retours,${report.returnCount}\n\n` +
      'Résumé Financier\n' +
      `Ventes totales,${(report.totalSales || 0).toFixed(2)}€\n` +
      `Retours totaux,${(report.totalReturns || 0).toFixed(2)}€\n` +
      `Revenu net,${(report.netRevenue || 0).toFixed(2)}€\n\n` +
      'Modes de Paiement\n' +
      Object.entries(report.paymentMethods).map(([method, amount]) => 
        `${method},${(amount || 0).toFixed(2)}€`
      ).join('\n') + '\n\n' +
      'Volume des Articles\n' +
      Object.entries(report.productVolume).map(([productId, quantity]) => {
        const product = productsDatabase.find(p => p.id === productId);
        return `${product ? product.name : productId},${quantity}`;
      }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport_cumulatif_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fonction Z (Clôture Caisse)
  const handleZAction = () => {
    setShowZConfirmation(true);
  };

  const confirmZAction = () => {
    // Sauvegarder le rapport du jour
    const dailyReport = calculateDailyReport();
    setDailyReports(prev => [...prev, dailyReport]);

    // Réinitialiser tous les compteurs et historiques
    setDailySalesCount({});
    setProductSalesCount({});
    setPaymentHistory([]);
    setReturnHistory([]);
    
    // Incrémenter le numéro Z
    setZNumber(prev => prev + 1);
    
    setShowZConfirmation(false);
  };

  const cancelZAction = () => {
    setShowZConfirmation(false);
  };

  // Fonctions utilitaires
  const openPaymentDetailsModal = (payment) => {
    setSelectedPayment(payment);
    setShowPaymentDetailsModal(true);
  };
  const closePaymentDetails = () => {
    setShowPaymentDetailsModal(false);
    setSelectedPayment(null);
  };

  const handleBarcodeSearch = (event) => {
    if (event.key === 'Enter') {
      const barcode = event.target.value;
      const product = getProductByEAN(barcode);
      if (product) {
        addToCart(product);
        event.target.value = '';
      }
    }
  };

  const getCounterColor = (count) => {
    if (count > 0) return '#ff4444';
    if (count === 0) return '#888888';
    return '#ffaa00';
  };

  const categories = getCategories();

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f5f5f5',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#2c3e50',
        color: 'white',
        padding: '15px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Caisse Enregistreuse</h1>
        <button
          onClick={onBackToMain}
          style={{
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Retour au Menu Principal
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        backgroundColor: '#34495e',
        display: 'flex',
        padding: '0 20px'
      }}>
        {['sales', 'payments', 'returns', 'reports'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              backgroundColor: activeTab === tab ? '#3498db' : 'transparent',
              color: 'white',
              border: 'none',
              padding: '15px 25px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: activeTab === tab ? 'bold' : 'normal'
            }}
          >
            {tab === 'sales' && 'Ventes'}
            {tab === 'payments' && 'Paiements'}
            {tab === 'returns' && 'Retours'}
            {tab === 'reports' && 'Rapports'}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {activeTab === 'sales' && (
          <div style={{ display: 'flex', width: '100%' }}>
            {/* Left Panel - Products */}
            <div style={{ flex: 2, padding: '20px', overflow: 'auto' }}>
              {/* Search Bar */}
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '1px solid #ddd',
                    borderRadius: '5px'
                  }}
                />
              </div>

              {/* View Mode Toggle */}
              <div style={{ marginBottom: '20px' }}>
                <button
                  onClick={() => setViewMode('products')}
                  style={{
                    backgroundColor: viewMode === 'products' ? '#3498db' : '#ecf0f1',
                    color: viewMode === 'products' ? 'white' : '#2c3e50',
                    border: 'none',
                    padding: '10px 20px',
                    marginRight: '10px',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Articles
                </button>
                <button
                  onClick={() => setViewMode('categories')}
                  style={{
                    backgroundColor: viewMode === 'categories' ? '#3498db' : '#ecf0f1',
                    color: viewMode === 'categories' ? 'white' : '#2c3e50',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Catégories
                </button>
              </div>

              {/* Products Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '15px'
              }}>
                {viewMode === 'categories' ? (
                  categories.map(category => (
                    <div
                      key={category}
                      onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                      style={{
                        backgroundColor: selectedCategory === category ? '#3498db' : 'white',
                        color: selectedCategory === category ? 'white' : '#2c3e50',
                        padding: '20px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        border: selectedCategory === category ? '2px solid #2980b9' : '1px solid #ddd'
                      }}
                    >
                      <h3 style={{ margin: '0 0 10px 0' }}>{category}</h3>
                      <div style={{ fontSize: '14px', opacity: 0.8 }}>
                        {filteredProducts.filter(p => p.category === category).length} articles
                      </div>
                    </div>
                  ))
                ) : (
                  filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => addToCart(product)}
                      style={{
                        backgroundColor: 'white',
                        padding: '15px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        border: '1px solid #ddd',
                        position: 'relative'
                      }}
                    >
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>{product.name}</h4>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>
                        {product.price.toFixed(2)}€
                      </div>
                      <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '5px' }}>
                        {product.category}
                      </div>
                      {productSalesCount[product.id] > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          backgroundColor: getCounterColor(productSalesCount[product.id]),
                          color: 'white',
                          borderRadius: '50%',
                          width: '25px',
                          height: '25px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {productSalesCount[product.id]}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Panel - Cart & Payment */}
            <div style={{ flex: 1, padding: '20px', backgroundColor: 'white', borderLeft: '1px solid #ddd' }}>
              {/* Cart */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>Panier</h3>
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#7f8c8d', padding: '40px' }}>
                    Panier vide
                  </div>
                ) : (
                  <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                    {cart.map(item => (
                      <div key={item.id} style={{
                        padding: '10px',
                        borderBottom: '1px solid #eee',
                        backgroundColor: '#f8f9fa'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                            {item.originalPrice && item.originalPrice !== item.price && (
                              <div style={{ fontSize: '12px', color: '#e67e22', textDecoration: 'line-through' }}>
                                {item.originalPrice.toFixed(2)}€
                              </div>
                            )}
                            <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
                              {(item.finalPrice || item.price).toFixed(2)}€ x {item.quantity}
                            </div>
                          </div>
                          <button
                            onClick={() => openPriceEditModal(item)}
                            style={{
                              backgroundColor: '#27ae60',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              width: '25px',
                              height: '25px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            €
                          </button>
                        </div>
                        
                        {/* Affichage de la remise */}
                        {item.discountPercentage > 0 && (
                          <div style={{
                            backgroundColor: '#e67e22',
                            color: 'white',
                            padding: '5px 10px',
                            borderRadius: '15px',
                            fontSize: '12px',
                            display: 'inline-block',
                            marginBottom: '5px'
                          }}>
                            -{(item.discountAmount * item.quantity).toFixed(2)}€ (-{item.discountPercentage}%)
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            style={{
                              backgroundColor: '#e74c3c',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              width: '25px',
                              height: '25px',
                              cursor: 'pointer'
                            }}
                          >
                            -
                          </button>
                          <span style={{ minWidth: '30px', textAlign: 'center' }}>{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            style={{
                              backgroundColor: '#27ae60',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              width: '25px',
                              height: '25px',
                              cursor: 'pointer'
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Section */}
              <div style={{ borderTop: '2px solid #eee', paddingTop: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>Paiement</h3>
                
                {/* Payment Mode Selection */}
                <div style={{ marginBottom: '20px' }}>
                  {['cash', 'card', 'check'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setPaymentMode(mode)}
                      style={{
                        backgroundColor: paymentMode === mode ? '#3498db' : '#ecf0f1',
                        color: paymentMode === mode ? 'white' : '#2c3e50',
                        border: 'none',
                        padding: '10px 20px',
                        marginRight: '10px',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      {mode === 'cash' && 'Espèces'}
                      {mode === 'card' && 'Carte'}
                      {mode === 'check' && 'Chèque'}
                    </button>
                  ))}
                </div>

                {/* Cart Summary */}
                <div style={{
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '5px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>Total HT:</span>
                    <span>{cartTotalHT.toFixed(2)}€</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>TVA (20%):</span>
                    <span>{cartTVA.toFixed(2)}€</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px' }}>
                    <span>Total TTC:</span>
                    <span>{cartTotal.toFixed(2)}€</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={processPayment}
                    disabled={cart.length === 0 || isProcessingPayment}
                    style={{
                      backgroundColor: cart.length === 0 ? '#bdc3c7' : '#27ae60',
                      color: 'white',
                      border: 'none',
                      padding: '15px 30px',
                      borderRadius: '5px',
                      cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      flex: 1
                    }}
                  >
                    {isProcessingPayment ? 'Traitement...' : 'Payer'}
                  </button>
                  <button
                    onClick={clearCart}
                    style={{
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      padding: '15px 20px',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Vider
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div style={{ padding: '20px', width: '100%' }}>
            <h2>Historique des Paiements</h2>
            {paymentHistory.length === 0 ? (
              <p>Aucun paiement enregistré</p>
            ) : (
              <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                {paymentHistory.map(payment => (
                  <div key={payment.id} style={{
                    backgroundColor: payment.isReturn ? '#ffe6e6' : 'white',
                    padding: '15px',
                    marginBottom: '10px',
                    borderRadius: '5px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderLeft: payment.isReturn ? '4px solid #e74c3c' : 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{new Date(payment.timestamp).toLocaleString()}</strong>
                        <div style={{ color: '#7f8c8d' }}>
                          {payment.items.length} article(s) - {payment.paymentMode}
                          {payment.isReturn && <span style={{ color: '#e74c3c', fontWeight: 'bold' }}> (RETOUR)</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          onClick={() => openPaymentDetailsModal(payment)}
                          style={{
                            backgroundColor: '#3498db',
                            color: 'white',
                            border: 'none',
                            padding: '5px 10px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Détails
                        </button>
                        <div style={{ 
                          fontSize: '18px', 
                          fontWeight: 'bold',
                          color: payment.isReturn ? '#e74c3c' : 'inherit'
                        }}>
                          {payment.isReturn ? '-' : ''}{Math.abs(payment.total || 0).toFixed(2)}€
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'returns' && (
          <div style={{ padding: '20px', width: '100%' }}>
            <h2>Gestion des Retours</h2>
            
            {/* Mode de retour */}
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={() => setReturnMode('spontaneous')}
                style={{
                  backgroundColor: returnMode === 'spontaneous' ? '#3498db' : '#ecf0f1',
                  color: returnMode === 'spontaneous' ? 'white' : '#2c3e50',
                  border: 'none',
                  padding: '10px 20px',
                  marginRight: '10px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Retour Spontané
              </button>
              <button
                onClick={() => setReturnMode('existing')}
                style={{
                  backgroundColor: returnMode === 'existing' ? '#3498db' : '#ecf0f1',
                  color: returnMode === 'existing' ? 'white' : '#2c3e50',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Retour sur Vente Existante
              </button>
            </div>

            {returnMode === 'existing' && (
              <div style={{ marginBottom: '20px' }}>
                <h3>Sélectionner une vente</h3>
                <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '10px' }}>
                  {paymentHistory.filter(p => !p.isReturn).map(payment => (
                    <div
                      key={payment.id}
                      onClick={() => setSelectedSaleForReturn(payment)}
                      style={{
                        backgroundColor: selectedSaleForReturn?.id === payment.id ? '#3498db' : 'white',
                        color: selectedSaleForReturn?.id === payment.id ? 'white' : '#2c3e50',
                        padding: '10px',
                        marginBottom: '5px',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        border: '1px solid #ddd'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{new Date(payment.timestamp).toLocaleString()}</span>
                        <span>{(payment.total || 0).toFixed(2)}€</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recherche de produits pour retour spontané */}
            {returnMode === 'spontaneous' && (
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Rechercher un produit pour retour..."
                  value={returnProductSearch}
                  onChange={(e) => setReturnProductSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '5px'
                  }}
                />
                <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '10px' }}>
                  {returnFilteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => addItemToReturn(product)}
                      style={{
                        backgroundColor: 'white',
                        padding: '10px',
                        marginBottom: '5px',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        border: '1px solid #ddd'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{product.name}</span>
                        <span>{product.price.toFixed(2)}€</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Articles à retourner */}
            {returnItems.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3>Articles à retourner</h3>
                <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                  {returnItems.map(item => (
                    <div key={item.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px',
                      backgroundColor: '#f8f9fa',
                      marginBottom: '5px',
                      borderRadius: '5px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                        <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
                          {(item.finalPrice || item.price).toFixed(2)}€ x {item.quantity}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          onClick={() => updateReturnQuantity(item.id, item.quantity - 1)}
                          style={{
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            width: '25px',
                            height: '25px',
                            cursor: 'pointer'
                          }}
                        >
                          -
                        </button>
                        <span style={{ minWidth: '30px', textAlign: 'center' }}>{item.quantity}</span>
                        <button
                          onClick={() => updateReturnQuantity(item.id, item.quantity + 1)}
                          style={{
                            backgroundColor: '#27ae60',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            width: '25px',
                            height: '25px',
                            cursor: 'pointer'
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Paiement du retour */}
            {returnItems.length > 0 && (
              <div style={{ borderTop: '2px solid #eee', paddingTop: '20px' }}>
                <h3>Paiement du retour</h3>
                <div style={{ marginBottom: '15px' }}>
                  {['cash', 'card', 'check'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setReturnPaymentMode(mode)}
                      style={{
                        backgroundColor: returnPaymentMode === mode ? '#3498db' : '#ecf0f1',
                        color: returnPaymentMode === mode ? 'white' : '#2c3e50',
                        border: 'none',
                        padding: '8px 16px',
                        marginRight: '10px',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      {mode === 'cash' && 'Espèces'}
                      {mode === 'card' && 'Carte'}
                      {mode === 'check' && 'Chèque'}
                    </button>
                  ))}
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <label>Montant reçu:</label>
                  <input
                    type="number"
                    value={returnAmountReceived}
                    onChange={(e) => setReturnAmountReceived(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '14px',
                      border: '1px solid #ddd',
                      borderRadius: '5px'
                    }}
                  />
                </div>

                <div style={{
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '5px',
                  marginBottom: '15px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>Total retour:</span>
                    <span>{returnItems.reduce((total, item) => total + ((item.finalPrice || item.price) * item.quantity), 0).toFixed(2)}€</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>Change:</span>
                    <span>{(returnChange || 0).toFixed(2)}€</span>
                  </div>
                </div>

                <button
                  onClick={processReturn}
                  disabled={returnItems.length === 0 || isProcessingReturnPayment}
                  style={{
                    backgroundColor: returnItems.length === 0 ? '#bdc3c7' : '#e74c3c',
                    color: 'white',
                    border: 'none',
                    padding: '15px 30px',
                    borderRadius: '5px',
                    cursor: returnItems.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '16px'
                  }}
                >
                  {isProcessingReturnPayment ? 'Traitement...' : 'Traiter le retour'}
                </button>
              </div>
            )}

            {/* Historique des retours */}
            <div style={{ marginTop: '30px' }}>
              <h3>Historique des retours</h3>
              {returnHistory.length === 0 ? (
                <p>Aucun retour enregistré</p>
              ) : (
                <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                  {returnHistory.map(returnRecord => (
                    <div key={returnRecord.id} style={{
                      backgroundColor: 'white',
                      padding: '15px',
                      marginBottom: '10px',
                      borderRadius: '5px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      borderLeft: '4px solid #e74c3c'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{new Date(returnRecord.timestamp).toLocaleString()}</strong>
                          <div style={{ color: '#7f8c8d' }}>
                            {returnRecord.items.length} article(s) - {returnRecord.paymentMode}
                          </div>
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e74c3c' }}>
                          -{(returnRecord.totalAmount || 0).toFixed(2)}€
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div style={{ padding: '20px', width: '100%' }}>
            <h2>Rapports</h2>
            
            {/* Boutons d'action */}
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={saveDailyReport}
                style={{
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  marginRight: '10px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Sauvegarder Rapport Quotidien
              </button>
              <button
                onClick={handleZAction}
                style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Cloture Caisse (Z-{zNumber})
              </button>
            </div>

            {/* Vue des rapports */}
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={() => setCumulativeView(false)}
                style={{
                  backgroundColor: !cumulativeView ? '#3498db' : '#ecf0f1',
                  color: !cumulativeView ? 'white' : '#2c3e50',
                  border: 'none',
                  padding: '10px 20px',
                  marginRight: '10px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Rapports Quotidiens
              </button>
              <button
                onClick={() => setCumulativeView(true)}
                style={{
                  backgroundColor: cumulativeView ? '#3498db' : '#ecf0f1',
                  color: cumulativeView ? 'white' : '#2c3e50',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Rapport Cumulatif
              </button>
            </div>

            {/* Affichage des rapports */}
            {!cumulativeView ? (
              <div>
                <h3>Rapports Quotidiens Sauvegardés</h3>
                {dailyReports.length === 0 ? (
                  <p>Aucun rapport sauvegardé</p>
                ) : (
                  <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                    {dailyReports.map((report, index) => (
                      <div key={index} style={{
                        backgroundColor: 'white',
                        padding: '15px',
                        marginBottom: '10px',
                        borderRadius: '5px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>Rapport du {report.date}</strong>
                            <div style={{ color: '#7f8c8d' }}>
                              {report.transactionCount} transactions, {report.returnCount} retours
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={() => showReportDetailsModal(report)}
                              style={{
                                backgroundColor: '#3498db',
                                color: 'white',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Détails
                            </button>
                            <button
                              onClick={() => exportReportToCSV(report)}
                              style={{
                                backgroundColor: '#27ae60',
                                color: 'white',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Export CSV
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3>Rapport Cumulatif</h3>
                <button
                  onClick={() => {
                    const report = calculateCumulativeReport();
                    setCumulativeReport(report);
                  }}
                  style={{
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    marginBottom: '15px',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Calculer Rapport Cumulatif
                </button>
                
                {cumulativeReport && (
                  <div style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '5px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    <h4>Résumé Financier</h4>
                    <div style={{ marginBottom: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span>Ventes totales:</span>
                        <span>{(cumulativeReport.totalSales || 0).toFixed(2)}€</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span>Retours totaux:</span>
                        <span>{(cumulativeReport.totalReturns || 0).toFixed(2)}€</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span>Revenu net:</span>
                        <span>{(cumulativeReport.netRevenue || 0).toFixed(2)}€</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => exportCumulativeReportToCSV(cumulativeReport)}
                      style={{
                        backgroundColor: '#27ae60',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      Export CSV
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        backgroundColor: '#2c3e50',
        color: 'white',
        padding: '10px 20px',
        textAlign: 'center',
        fontSize: '14px'
      }}>
        Klick Management - Caisse Enregistreuse
      </div>

      {/* Modals */}
      
      {/* Modal de modification de prix */}
      {showPriceEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            minWidth: '400px'
          }}>
            <h3>Modifier le prix</h3>
            <div style={{ marginBottom: '15px' }}>
              <label>Nouveau prix:</label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label>Remise (%):</label>
              <input
                type="number"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={applyPriceModification}
                style={{
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Appliquer
              </button>
              <button
                onClick={closePriceEditModal}
                style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de détails de paiement */}
      {showPaymentDetailsModal && selectedPayment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>Détails de la transaction</h3>
            <div style={{ marginBottom: '15px' }}>
              <strong>Date:</strong> {new Date(selectedPayment.timestamp).toLocaleString()}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Mode de paiement:</strong> {selectedPayment.paymentMode}
            </div>
            <div style={{ marginBottom: '15px' }}>
                              <strong>Total:</strong> {(selectedPayment.total || 0).toFixed(2)}€
            </div>
            <div style={{ marginBottom: '20px' }}>
              <strong>Articles:</strong>
              {selectedPayment.items.map(item => (
                <div key={item.id} style={{
                  padding: '5px 0',
                  borderBottom: '1px solid #eee'
                }}>
                  {item.name} - {item.quantity}x {(item.finalPrice || item.price).toFixed(2)}€
                </div>
              ))}
            </div>
            <button
              onClick={closePaymentDetails}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmation Z */}
      {showZConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <h3>⚠️ Confirmation de Clôture Caisse</h3>
            <p style={{ marginBottom: '20px' }}>
              Êtes-vous sûr de vouloir effectuer la clôture caisse (Z-{zNumber}) ?<br/>
              Cette action va :
            </p>
            <ul style={{ textAlign: 'left', marginBottom: '20px' }}>
              <li>Sauvegarder le rapport quotidien</li>
              <li>Réinitialiser tous les compteurs</li>
              <li>Vider l'historique des paiements et retours</li>
              <li>Incémenter le numéro Z</li>
            </ul>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={confirmZAction}
                style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Confirmer Clôture
              </button>
              <button
                onClick={cancelZAction}
                style={{
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de détails de rapport */}
      {showReportModal && selectedReport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>Détails du Rapport - {selectedReport.date}</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <h4>Résumé Financier</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>Ventes totales:</span>
                <span>{(selectedReport.totalSales || 0).toFixed(2)}€</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>Retours totaux:</span>
                <span>{(selectedReport.totalReturns || 0).toFixed(2)}€</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>Revenu net:</span>
                <span>{(selectedReport.netRevenue || 0).toFixed(2)}€</span>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4>Modes de Paiement</h4>
              {Object.entries(selectedReport.paymentMethods).map(([method, amount]) => (
                <div key={method} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span>{method}:</span>
                  <span>{(amount || 0).toFixed(2)}€</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4>Volume des Articles</h4>
              {Object.entries(selectedReport.productVolume).map(([productId, quantity]) => {
                const product = productsDatabase.find(p => p.id === productId);
                return (
                  <div key={productId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>{product ? product.name : productId}:</span>
                    <span>{quantity}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => exportReportToCSV(selectedReport)}
                style={{
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Export CSV
              </button>
              <button
                onClick={closeReportModal}
                style={{
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashRegisterApp; 