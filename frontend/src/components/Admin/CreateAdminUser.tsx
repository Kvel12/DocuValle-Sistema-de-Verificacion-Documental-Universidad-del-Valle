import { useState, useEffect } from 'react';
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
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);


  const navigate = useNavigate();

  useEffect(() => {
  const fetchAdminUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setAdminUsers(data);
    } catch (error) {
      console.error('Error al obtener usuarios del backend:', error);
    }
  };
  fetchAdminUsers();
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim() || !correo.trim() || !contrasena.trim()) {
      setMensaje('Todos los campos son obligatorios.');
      return;
    }

    const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
    if (!correoValido) {
      setMensaje('Por favor, ingresa un correo válido.');
      return;
    }

    if (contrasena.length < 6) {
      setMensaje('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      if (editandoId) {
        // EDITAR usuario existente
        const res = await fetch(`/api/users/${editandoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, correo, contrasena })
        });

        if (!res.ok) throw new Error('Error al editar');

        setAdminUsers((prev) =>
          prev.map((u) => (u.id === editandoId ? { ...u, nombre, correo } : u))
        );
        setMensaje('✅ Usuario editado correctamente.');
        setEditandoId(null);
      } else {
        // CREAR nuevo usuario
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, correo, contrasena })
        });

        const data = await res.json();
        setAdminUsers((prev) => [...prev, { id: data.id, nombre, correo }]);
        setMensaje('✅ Usuario creado exitosamente.');
      }

      setNombre('');
      setCorreo('');
      setContrasena('');
    } catch (error) {
      console.error('Error al crear/editar usuario:', error);
      setMensaje('❌ Error al guardar usuario.');
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este usuario?')) return;

    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      setAdminUsers((prev) => prev.filter((u) => u.id !== id));
      setMensaje('✅ Usuario eliminado correctamente.');
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      setMensaje('❌ Error al eliminar usuario.');
    }
  };

  const handleEdit = (user: AdminUser) => {
    setEditandoId(user.id);
    setNombre(user.nombre);
    setCorreo(user.correo);
    setMensaje('✏️ Editando usuario...');
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
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type={mostrarContrasena ? 'text' : 'password'}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setMostrarContrasena((prev) => !prev)}
                style={{
                  marginLeft: '0.5rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
                title={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarContrasena ? '🙈' : '🧿'}
              </button>
            </div>
          </div>

          <button type="submit" className="form-button">
            {editandoId ? 'Actualizar Usuario' : 'Crear Usuario'}
          </button>
          {mensaje && <p className="form-message">{mensaje}</p>}
        </form>

        <div className="button-group">
          <button className="back-button" onClick={handleBack}>Volver al inicio</button>
        </div>
      </div>

      <div className="admin-list">
        <h3>Usuarios Administradores</h3>
        {adminUsers.length === 0 ? (
          <p>No hay administradores registrados.</p>
        ) : (
          <ul>
            {adminUsers.map((user) => (
              <li key={user.id} style={{ marginBottom: '1rem' }}>
                <strong>{user.nombre}</strong><br />
                <span>{user.correo}</span><br />
                <button onClick={() => handleEdit(user)}>✏️ Editar</button>{' '}
                <button onClick={() => handleDelete(user.id)}>🗑️ Eliminar</button>
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
