import { X } from 'lucide-react'

export default function ConfirmModal({
  isOpen,
  title = 'Confirmação',
  message = 'Tem certeza?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onCancel,
  onConfirm
}: {
  isOpen: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-40 mx-auto p-5 border max-w-md shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-6">
          <p className="text-sm text-gray-700">{message}</p>
        </div>
        <div className="flex justify-end space-x-3">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded-md">{cancelText}</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md">{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
