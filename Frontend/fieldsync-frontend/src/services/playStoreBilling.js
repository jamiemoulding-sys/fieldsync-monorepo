// Google Play Store Billing Service
// Handles all subscription payments through Google Play Store

class PlayStoreBilling {
  constructor() {
    this.isReady = false;
    this.products = [];
    this.purchases = [];
    this.listeners = new Map();
  }

  // Initialize Google Play Billing
  async initialize() {
    try {
      if (!window.google) {
        throw new Error('Google Play Services not available');
      }

      // Initialize billing client
      this.billingClient = new window.google.play.billing.BillingClient({
        environment: 'PRODUCTION', // Use 'TEST' for testing
      });

      // Check if billing is supported
      const isSupported = await this.billingClient.isSupported();
      if (!isSupported) {
        throw new Error('Google Play Billing not supported on this device');
      }

      // Get available products
      const products = await this.billingClient.getProducts([
        'basic_monthly_subscription',
        'additional_employee_monthly'
      ]);

      this.products = products;
      this.isReady = true;

      console.log('Play Store Billing initialized:', products);
      return true;
    } catch (error) {
      console.error('Play Store Billing initialization failed:', error);
      throw error;
    }
  }

  // Get current purchases
  async getPurchases() {
    try {
      if (!this.isReady) {
        throw new Error('Billing not initialized');
      }

      const purchases = await this.billingClient.getPurchases();
      this.purchases = purchases;
      return purchases;
    } catch (error) {
      console.error('Failed to get purchases:', error);
      throw error;
    }
  }

  // Purchase subscription
  async purchaseSubscription(productId, employeeCount = 1) {
    try {
      if (!this.isReady) {
        throw new Error('Billing not initialized');
      }

      // Find product details
      const product = this.products.find(p => p.productId === productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Calculate total price based on employee count
      let totalPrice = product.price;
      if (productId === 'additional_employee_monthly') {
        totalPrice = product.price * employeeCount;
      }

      // Create purchase request
      const purchaseRequest = {
        productId,
        quantity: 1,
        developerPayload: JSON.stringify({
          employeeCount,
          timestamp: Date.now(),
          version: '1.0'
        })
      };

      // Launch purchase flow
      const purchase = await this.billingClient.purchase(purchaseRequest);
      
      console.log('Purchase completed:', purchase);
      return purchase;
    } catch (error) {
      console.error('Purchase failed:', error);
      throw error;
    }
  }

  // Check if user has active subscription
  hasActiveSubscription() {
    return this.purchases.some(purchase => 
      purchase.type === 'subscription' && 
      purchase.state === 'approved' && 
      !purchase.isExpired
    );
  }

  // Get subscription details
  getSubscriptionDetails() {
    const activeSubscription = this.purchases.find(purchase => 
      purchase.type === 'subscription' && 
      purchase.state === 'approved' && 
      !purchase.isExpired
    );

    if (!activeSubscription) {
      return null;
    }

    const product = this.products.find(p => p.productId === activeSubscription.productId);
    
    return {
      productId: activeSubscription.productId,
      title: product?.title || 'Subscription',
      price: product?.price || 0,
      currency: product?.currency || 'USD',
      purchaseTime: activeSubscription.purchaseTime,
      expiryTime: activeSubscription.expiryTime,
      developerPayload: JSON.parse(activeSubscription.developerPayload || '{}')
    };
  }

  // Add event listener
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Remove event listener
  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Trigger event
  triggerEvent(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  // Acknowledge purchase
  async acknowledgePurchase(purchaseToken) {
    try {
      await this.billingClient.acknowledgePurchase(purchaseToken);
      console.log('Purchase acknowledged:', purchaseToken);
      return true;
    } catch (error) {
      console.error('Failed to acknowledge purchase:', error);
      return false;
    }
  }
}

export default new PlayStoreBilling();
