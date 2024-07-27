module.exports = (sequelize, DataTypes) => {
  const Task = sequelize.define('Task', {
    title: DataTypes.STRING,
    status: DataTypes.STRING,
    userId: DataTypes.INTEGER
  }, {});

  Task.associate = function(models) {
    Task.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return Task;
};
