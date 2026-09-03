export const seedData = {
  users: [
    {
      nric: "S0000001A",
      passwordHash: "civicvoice-citizen-salt-v1:b7f81d61cde72e4606e89409ec5af031d8bfd507b493f17d77dfc7848d4801b7fb7906b92e494edde244dcb24f5b9684be22906d49eeccd9a06ed03237492b7c",
      name: "Aisha Rahman",
      role: "citizen",
    },
    {
      nric: "S0000002B",
      passwordHash: "civicvoice-admin-salt-v1:6aae2439c5203d10d55906d2911040aa085a6858b03fd629705c59e1a7efbc05e3ed3562bb1a575a0a1fe95ab3636aa525e7c593bf39c589c7ecab3e69ec1bff",
      name: "Daniel Tan",
      role: "admin",
    },
  ],
  feedback: [
    {
      id: "fb-seed-1",
      nric: "S0000001A",
      name: "Aisha Rahman",
      message: "The new sheltered walkway near the library is helpful, but the lights turn off too early.",
      category: "General",
      status: "New",
      createdAt: "2026-08-29T09:14:00.000Z",
    },
  ],
};

export function freshSeed() {
  return structuredClone(seedData);
}
