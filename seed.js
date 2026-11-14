const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.review.deleteMany();
  await prisma.book.deleteMany();
  await prisma.author.deleteMany();

  const author = await prisma.author.create({
    data: {
      name: 'Ursula K. Le Guin',
      email: 'ursula@example.com',
      bio: 'American author known for speculative fiction.',
      books: {
        create: [
          {
            title: 'A Wizard of Earthsea',
            isbn: '9780547773742',
            description: 'A young wizard discovers the cost of power.',
            publishedAt: new Date('1968-01-01'),
            reviews: {
              create: [{ reviewer: 'Sam Reader', rating: 5, body: 'A timeless classic.' }]
            }
          },
          {
            title: 'The Left Hand of Darkness',
            isbn: '9780441478125',
            description: 'An envoy travels to a world without fixed gender.',
            publishedAt: new Date('1969-03-01')
          }
        ]
      }
    }
  });

  console.log(`Seeded author ${author.id} with two books.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
