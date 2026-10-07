const config = {
  bars: [
    {
      id: 'delucas',
      name: "De Luca's",
      phone: '34653079184', // Reemplazar con el número real del bar
      menu: [
        { id: 'semana', name: 'Bocadillo de la semana', description: 'Consultar' },
        { id: 'albelda', name: '1. Albelda', description: 'Lomo con ajitos tiernos y queso manchego' },
        { id: 'canizares', name: '2. Cañizares', description: 'Bacón con tortilla francesa y tomate' },
        { id: 'kemmpes', name: '3. Kemmpes', description: 'Revuelto de setas con picadillo de ajitos y perejil con jamón' },
        { id: 'camarasa', name: '4. Camarasa', description: 'Jamón a la catalana con opción de queso manchego' },
        { id: 'arias', name: '5. Arias', description: 'Pechuga de pollo, mayonesa, cebolla caramelizada, lechuga y huevo frito' },
        { id: 'sempere', name: '6. Sempere', description: 'Muslo de pollo deshuesado, patatas panaderas y ajoaceite' },
        { id: 'fernando', name: '7. Fernando', description: 'Carne de caballo con ajitos tiernos (no incluye bebida ni café)' },
        { id: 'giner', name: '8. Giner', description: 'Sobrasada plancha, jamón york, queso y longaniza' },
        { id: 'sol', name: '9. Sol', description: 'Queso fresco con tomate y anchoas' },
        { id: 'puchades', name: '10. Puchades', description: 'Ternera con jamón y cebolla' },
        { id: 'gaya', name: '12. Gayá', description: 'Pincho moruno con huevo y ajoaceite' },
        { id: 'csoler', name: '13. C. Soler', description: 'Calamares con ajoaceite' },
        { id: 'carroyo', name: '14. C. Arroyo', description: 'Tortilla de patata con longaniza y alioli' },
        { id: 'vicente', name: '15. Vicente', description: 'Longanizas, patatas panadera, ajoaceite y pimientos' },
        { id: 'angulo', name: '16. Angulo', description: 'Figatells, patata panadera y alioli' },
        { id: 'delucas', name: 'De Lucas', description: 'Pincho moruno, alioli, patatas panadera, huevo, queso de cabra y cebolla crujiente' },
        { id: 'medio', name: '1/2 almuerzo', description: 'Medio almuerzo (tostada o similar)' },
        { id: 'iberico', name: 'Jamón ibérico', description: 'Almuerzo de jamón ibérico (13,00€)' },
        { id: 'medio-iberico', name: '1/2 almuerzo ibérico', description: 'Medio almuerzo de jamón ibérico (10,00€)' },
      ]
    }
  ],
  defaultBarId: 'delucas',
  defaultDeadlineHour: 8,
  defaultDeadlineMinute: 30,
};

module.exports = config;
