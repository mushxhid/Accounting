import React, { useState, useEffect } from 'react';
import { Plus, X, Calendar, CreditCard, User, ChevronDown, FileText, RefreshCw, Upload, Image as ImageIcon } from 'lucide-react';
import { ExpenseFormData, Contact } from '../types';
import { fetchPKRtoUSDRate, convertPKRtoUSD, formatUSD, formatExchangeRate } from '../utils/currencyConverter';
import { uploadImageToCloudinary } from '../utils/cloudinary';

interface ExpenseFormProps {
  onSubmit: (data: ExpenseFormData) => void;
  onCancel: () => void;
  contacts: Contact[];
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSubmit, onCancel, contacts }) => {
  const [formData, setFormData] = useState<ExpenseFormData>({
    name: '',
    amount: '',
    usdAmount: '',
    accountNumber: '',
    contactId: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const [exchangeRate, setExchangeRate] = useState<number>(280); // Default fallback rate
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(false);
  const [lastRateUpdate, setLastRateUpdate] = useState<string>('');

  const [errors, setErrors] = useState<Partial<ExpenseFormData>>({});
  const [selectedContact, setSelectedContact] = useState<string>('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<ExpenseFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Expense name is required';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valid amount is required';
    }

    if (!formData.accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field: keyof ExpenseFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleContactSelect = (contact: Contact) => {
    setFormData(prev => ({
      ...prev,
      accountNumber: contact.accountNumber,
      contactId: contact.id
    }));
    setSelectedContact(contact.id);
    setShowContactDropdown(false);
  };

  const handleManualInput = () => {
    setSelectedContact('');
    setFormData(prev => ({
      ...prev,
      name: '',
      accountNumber: '',
      contactId: ''
    }));
    setShowContactDropdown(false);
    // Focus on the name field after clearing
    setTimeout(() => {
      const nameInput = document.querySelector('input[name="expense-name"]') as HTMLInputElement;
      if (nameInput) {
        nameInput.focus();
      }
    }, 100);
  };

  const selectedContactData = contacts.find(c => c.id === selectedContact);

  // Filter contacts based on search query
  const filteredContacts = contacts.filter(contact => {
    if (!contactSearchQuery.trim()) return true;
    const query = contactSearchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.accountNumber.toLowerCase().includes(query) ||
      (contact.description && contact.description.toLowerCase().includes(query))
    );
  });

  // Handle image selection and upload
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, GIF, etc.)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size should be less than 10MB');
      return;
    }

    setSelectedImage(file);
    setUploadingImage(true);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      // Upload to Cloudinary
      const result = await uploadImageToCloudinary(file);
      setFormData(prev => ({
        ...prev,
        receiptImageUrl: result.secure_url,
      }));
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload image. Please try again.');
      setSelectedImage(null);
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setFormData(prev => ({
      ...prev,
      receiptImageUrl: undefined,
    }));
  };

  // Fetch exchange rate on component mount
  useEffect(() => {
    fetchExchangeRate();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showContactDropdown && !target.closest('.contact-dropdown-container')) {
        setShowContactDropdown(false);
        setContactSearchQuery('');
      }
    };

    if (showContactDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showContactDropdown]);

  const fetchExchangeRate = async () => {
    setIsLoadingRate(true);
    try {
      const rate = await fetchPKRtoUSDRate();
      setExchangeRate(rate);
      setLastRateUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
    } finally {
      setIsLoadingRate(false);
    }
  };

  // Auto-convert PKR to USD when amount changes
  useEffect(() => {
    if (formData.amount && !isNaN(parseFloat(formData.amount))) {
      const pkrAmount = parseFloat(formData.amount);
      const usdAmount = convertPKRtoUSD(pkrAmount, exchangeRate);
      setFormData(prev => ({
        ...prev,
        usdAmount: usdAmount.toFixed(2)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        usdAmount: ''
      }));
    }
  }, [formData.amount, exchangeRate]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add New Expense
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Contact Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Contact (Optional)
            </label>
            <div className="relative contact-dropdown-container">
              <button
                type="button"
                onClick={() => {
                  setShowContactDropdown(!showContactDropdown);
                  if (!showContactDropdown) {
                    setContactSearchQuery('');
                  }
                }}
                className="w-full flex items-center justify-between p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <User className="text-gray-400" size={20} />
                  <span className={selectedContactData ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                    {selectedContactData ? selectedContactData.name : contacts.length > 0 ? 'Choose a contact or enter manually' : 'No contacts available - Enter manually'}
                  </span>
                </div>
                <ChevronDown className={`text-gray-400 transition-transform ${showContactDropdown ? 'rotate-180' : ''}`} size={16} />
              </button>
              
              {showContactDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                  {/* Search Input */}
                  {contacts.length > 0 && (
                    <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                      <input
                        type="text"
                        value={contactSearchQuery}
                        onChange={(e) => setContactSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            // Select first filtered contact if available
                            if (filteredContacts.length > 0) {
                              handleContactSelect(filteredContacts[0]);
                            }
                          }
                        }}
                        placeholder="Search contacts..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    </div>
                  )}
                  
                  {/* Contact List */}
                  <div className="overflow-y-auto max-h-48">
                    <button
                      type="button"
                      onClick={handleManualInput}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 text-primary-600 dark:text-primary-400 font-medium"
                    >
                      + Enter manually
                    </button>
                    {filteredContacts.length > 0 ? (
                      filteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => handleContactSelect(contact)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0 ${selectedContact === contact.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                        >
                          <div className="font-medium text-gray-900 dark:text-white">{contact.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{contact.accountNumber}</div>
                          {contact.description && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">{contact.description}</div>
                          )}
                        </button>
                      ))
                    ) : contacts.length > 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No contacts found matching "{contactSearchQuery}"
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No contacts available
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expense Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expense Name
            </label>
            <div className="relative">
              <input
                type="text"
                name="expense-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`input-field ${errors.name ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="e.g., Office Supplies, Marketing"
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-sm text-danger-600">{errors.name}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Amount (PKR)
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={fetchExchangeRate}
                  disabled={isLoadingRate}
                  className="flex items-center text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50"
                  title="Refresh exchange rate"
                >
                  <RefreshCw size={12} className={`mr-1 ${isLoadingRate ? 'animate-spin' : ''}`} />
                  {isLoadingRate ? 'Updating...' : 'Refresh Rate'}
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Rate: {formatExchangeRate(exchangeRate)} = $1.00
                </span>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm font-medium">PKR</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className={`input-field pl-12 ${errors.amount ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="0.00"
              />
            </div>
            {formData.usdAmount && (
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">USD Equivalent:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatUSD(parseFloat(formData.usdAmount))}</span>
                </div>
                {lastRateUpdate && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Rate updated: {lastRateUpdate}
                  </div>
                )}
              </div>
            )}
            {errors.amount && (
              <p className="mt-1 text-sm text-danger-600">{errors.amount}</p>
            )}
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Account Number
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                className={`input-field pl-10 ${errors.accountNumber ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="e.g., 1234-5678-9012-3456"
              />
            </div>
            {errors.accountNumber && (
              <p className="mt-1 text-sm text-danger-600">{errors.accountNumber}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (Optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-gray-400" size={20} />
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="input-field pl-10 resize-none"
                rows={3}
                placeholder="e.g., Monthly office supplies, Amazon PPC campaign, Freelance work"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className={`input-field pl-10 ${errors.date ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
              />
            </div>
            {errors.date && (
              <p className="mt-1 text-sm text-danger-600">{errors.date}</p>
            )}
          </div>

          {/* Payment Screenshot Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Screenshot (Optional)
            </label>
            <div className="space-y-3">
              {!imagePreview ? (
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="receipt-upload"
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border-gray-300 dark:border-gray-600 ${
                      uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PNG, JPG, GIF up to 10MB
                      </p>
                    </div>
                    <input
                      id="receipt-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageSelect}
                      disabled={uploadingImage}
                    />
                  </label>
                </div>
              ) : (
                <div className="relative">
                  <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-gray-700">
                    <img
                      src={imagePreview}
                      alt="Receipt preview"
                      className="max-w-full max-h-48 mx-auto rounded"
                    />
                  </div>
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                      <div className="text-white text-sm font-medium">Uploading to Cloudinary...</div>
                    </div>
                  )}
                  {!uploadingImage && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="mt-2 flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <X size={16} />
                      Remove Image
                    </button>
                  )}
                </div>
              )}
              {uploadingImage && !imagePreview && (
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Uploading image...</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center"
            >
              <Plus size={16} className="mr-2" />
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseForm; 