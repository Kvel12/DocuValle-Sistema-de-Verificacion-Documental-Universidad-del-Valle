import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useNavigate } from 'react-router-dom';

const CreateAdminUser = () => {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mensaje, setMensaje] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre || !correo || !contrasena) {
      setMensaje('Todos los campos son obligatorios.');
      return;
    }

    try {
      await addDoc(collection(db, 'adminUsers'), {
        nombre,
        correo,
        contrasena,
      });
      setMensaje('✅ Usuario administrador creado exitosamente.');
      setNombre('');
      setCorreo('');
      setContrasena('');
    } catch (error) {
      console.error('Error creando usuario:', error);
      setMensaje('❌ Error al crear usuario.');
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-violet-700 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Crear Administrador</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              placeholder="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base"
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-1">Correo</label>
            <input
              type="email"
              placeholder="Correo"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base"
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              placeholder="Contraseña"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 text-white text-lg font-semibold py-3 rounded-lg hover:bg-purple-700 transition"
          >
            Crear Usuario
          </button>
          {mensaje && <p className="text-center text-sm text-gray-700">{mensaje}</p>}
        </form>
        <div className="mt-6 text-center">
          <button
            onClick={handleBack}
            className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition text-base"
          >
            ⬅️ Volver al Panel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateAdminUser;
