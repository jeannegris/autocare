import React from 'react'
import { AlertCircle } from 'lucide-react'

interface InputValidadoProps {
  label: string
  value: string
  onChange: (value: string) => void
  onValidate?: (value: string) => void
  error?: string
  type?: 'text' | 'email' | 'tel' | 'password'
  placeholder?: string
  required?: boolean
  maxLength?: number
  className?: string
  loading?: boolean
  disabled?: boolean
}

export default function InputValidado({
  label,
  value,
  onChange,
  onValidate,
  error,
  type = 'text',
  placeholder,
  required = false,
  maxLength,
  className = '',
  loading = false,
  disabled = false
}: InputValidadoProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    
    if (onValidate) {
      onValidate(newValue)
    }
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
            error 
              ? 'border-red-300 focus:ring-red-500' 
              : 'border-gray-300 focus:ring-blue-500'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          required={required}
        />
        {loading && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600 flex items-center">
          <AlertCircle className="h-4 w-4 mr-1" />
          {error}
        </p>
      )}
    </div>
  )
}