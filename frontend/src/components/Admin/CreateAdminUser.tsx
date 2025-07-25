import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useNavigate } from 'react-router-dom';

interface AdminUser {
  id: string;
  nombre: string;
  correo: string;
}

const CreateAdminUser = () => {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchAdminUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'adminUsers'));
        const users: AdminUser[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          nombre: doc.data().nombre,
          correo: doc.data().correo,
        }));
        setAdminUsers(users);
      } catch (error) {
        console.error('Error al obtener usuarios administradores:', error);
      }
    };

    fetchAdminUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre || !correo || !contrasena) {
      setMensaje('Todos los campos son obligatorios.');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'adminUsers'), {
        nombre,
        correo,
        contrasena,
      });

      setAdminUsers((prev) => [...prev, { id: docRef.id, nombre, correo }]);
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
  <div className="admin-wrapper">
    <div className="admin-content">
      <div className="form-container">
        <h2 className="form-title">Crear Administrador</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Correo</label>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </div>
          <button type="submit" className="form-button">Crear Usuario</button>
          {mensaje && <p className="form-message">{mensaje}</p>}
        </form>

        <div className="button-group">
          <button className="back-button" onClick={handleBack}>⬅️ Volver al inicio</button>
        </div>
      </div>

      <div className="admin-list">
        <h3>Usuarios Administradores</h3>
        {adminUsers.length === 0 ? (
          <p>No hay administradores registrados.</p>
        ) : (
          <ul>
            {adminUsers.map((user) => (
              <li key={user.id}>
                <strong>{user.nombre}</strong><br />
                <span>{user.correo}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  </div>
);

};

export default CreateAdminUser;
