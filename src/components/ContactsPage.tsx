import React, { useState } from 'react';
import { Plus, Trash2, User, CreditCard, FileText, Edit, Search } from 'lucide-react';
import { Contact } from '../types';

interface ContactsPageProps {
  contacts: Contact[];
  onAddContact: () => void;
  onDeleteContact: (id: string) => void;
  onEditContact: (contact: Contact) => void;
}

const ContactsPage: React.FC<ContactsPageProps> = ({ 
  contacts, 
  onAddContact, 
  onDeleteContact,
  onEditContact 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'accountNumber' | 'createdAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filter contacts by search term
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (contact.description && contact.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sort contacts
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'accountNumber':
        comparison = a.accountNumber.localeCompare(b.accountNumber);
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: 'name' | 'accountNumber' | 'createdAt') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-600 mt-1">Manage people you frequently pay</p>
        </div>
        <button
          onClick={onAddContact}
          className="btn-primary flex items-center"
        >
          <Plus size={20} className="mr-2" />
          Add Contact
        </button>
      </div>

      {/* Search and Sort */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-') as ['name' | 'accountNumber' | 'createdAt', 'asc' | 'desc'];
                setSortBy(field);
                setSortOrder(order);
              }}
              className="input-field"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="accountNumber-asc">Account (A-Z)</option>
              <option value="accountNumber-desc">Account (Z-A)</option>
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contacts List */}
      <div className="card">
        {sortedContacts.length === 0 ? (
          <div className="text-center py-12">
            <User className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No contacts found' : 'No contacts yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm 
                ? 'Try adjusting your search terms.'
                : 'Add your first contact to get started with quick expense entry.'
              }
            </p>
            {!searchTerm && (
              <button
                onClick={onAddContact}
                className="btn-primary"
              >
                Add Your First Contact
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
                    >
                      <User size={16} />
                      <span>Name</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('accountNumber')}
                      className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
                    >
                      <CreditCard size={16} />
                      <span>Account Number</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <FileText size={16} className="mr-1" />
                    Description
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('createdAt')}
                      className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
                    >
                      <span>Added</span>
                    </button>
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary-100 rounded-lg">
                          <User className="text-primary-600" size={16} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{contact.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-mono text-sm text-gray-700">{contact.accountNumber}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-gray-600 text-sm">
                        {contact.description || '—'}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-500">
                        {new Date(contact.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onEditContact(contact)}
                          className="text-primary-600 hover:text-primary-700 p-2 rounded-lg hover:bg-primary-50 transition-colors"
                          title="Edit contact"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => onDeleteContact(contact.id)}
                          className="text-danger-600 hover:text-danger-700 p-2 rounded-lg hover:bg-danger-50 transition-colors"
                          title="Delete contact"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactsPage; 