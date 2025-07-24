// frontend/src/components/AdminUserManager.tsx
import React, { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../src/config/firebase';

type AdminUser = {
  id?: string;
  name: string;
  email: string;
};

const AdminUserManager: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const querySnapshot = await getDocs(collection(db, 'adminUsers'));
    const userList = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as AdminUser),
    }));
    setUsers(userList);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return alert('Todos los campos son obligatorios');

    if (editMode && editingId) {
      await updateDoc(doc(db, 'adminUsers', editingId), { name, email });
      setEditMode(false);
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'adminUsers'), { name, email });
    }

    setName('');
    setEmail('');
    fetchUsers();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este usuario?')) return;
    await deleteDoc(doc(db, 'adminUsers', id));
    fetchUsers();
  };

  const handleEdit = (user: AdminUser) => {
    setName(user.name);
    setEmail(user.email);
    setEditingId(user.id || null);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setName('');
    setEmail('');
    setEditingId(null);
    setEditMode(false);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">
        {editMode ? 'Editar administrador' : 'Crear nuevo administrador'}
      </h2>

      <form onSubmit={handleSubmit} className="mb-6 space-y-4">
        <div>
          <label className="block mb-1 font-medium">Nombre:</label>
          <input
            type="text"
            className="border p-2 w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Correo:</label>
          <input
            type="email"
            className="border p-2 w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {editMode ? 'Actualizar' : 'Crear usuario'}
          </button>
          {editMode && (
            <button
              type="button"
              onClick={cancelEdit}
              className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <h2 className="text-xl font-bold mb-2">Administradores registrados</h2>
      {loading ? (
        <p>Cargando usuarios...</p>
      ) : users.length === 0 ? (
        <p>No hay administradores registrados.</p>
      ) : (
        <ul className="space-y-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex justify-between items-center border p-3 rounded"
            >
              <div>
                <strong>{user.name}</strong> - {user.email}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(user)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(user.id!)}
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminUserManager;
// This code defines a React component for managing admin users in a Firebase Firestore database.
// It allows creating, editing, and deleting admin users, and displays a list of registered admins