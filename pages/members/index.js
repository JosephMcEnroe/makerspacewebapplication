import { useEffect, useState } from "react";

//This is to test the database query data from railway

export default function Users() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function getUsers() {
      try {
        const response = await fetch("/api/users");

        const data = await response.json();

        if (data.ok) {
          setUsers(data.users);
        }

      } catch (error) {
        console.error("Error:", error);
      }
    }

    getUsers();
  }, []);

  return (
    <main>
      <h1>Users</h1>

      {users.map((user) => (
        <div key={user.user_id}>
          <h2>{user.first_name}</h2>
          <p>Phone numbers: {user.phone_number}</p>
          <p>Email: {user.email}</p>
          <p>rfid: {user.rfid_id}</p>
        </div>
      ))}
    </main>
  );
}