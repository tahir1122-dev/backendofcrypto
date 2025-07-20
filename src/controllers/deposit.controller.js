import Deposit from '../models/deposit.model.js';

// Get all deposits (for admin)
const getAllDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find()
      .populate('createdBy', 'name email')
      .sort({ order: 1, createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: deposits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deposits',
      error: error.message
    });
  }
};

// Get deposits for sellers/public
const getActiveDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find()
      .sort({ order: 1, createdAt: -1 })
      .select('-createdBy');
    
    res.status(200).json({
      success: true,
      data: deposits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deposits',
      error: error.message
    });
  }
};

// Get single deposit
const getDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: deposit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deposit',
      error: error.message
    });
  }
};

// Create new deposit
const createDeposit = async (req, res) => {
  try {
    const { title, content, order } = req.body;
    
    const deposit = new Deposit({
      title,
      content,
      order: order || 0,
      createdBy: req.user.id
    });

    await deposit.save();
    
    const populatedDeposit = await Deposit.findById(deposit._id)
      .populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      message: 'Deposit created successfully',
      data: populatedDeposit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to create deposit',
      error: error.message
    });
  }
};

// Update deposit
const updateDeposit = async (req, res) => {
  try {
    const { title, content, order } = req.body;
    
    const deposit = await Deposit.findByIdAndUpdate(
      req.params.id,
      {
        title,
        content,
        order
      },
      {
        new: true,
        runValidators: true
      }
    ).populate('createdBy', 'name email');
    
    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Deposit updated successfully',
      data: deposit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update deposit',
      error: error.message
    });
  }
};

// Delete deposit
const deleteDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findByIdAndDelete(req.params.id);
    
    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Deposit deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete deposit',
      error: error.message
    });
  }
};

// Update deposit order
const updateDepositOrder = async (req, res) => {
  try {
    const { order } = req.body;
    
    const deposit = await Deposit.findByIdAndUpdate(
      req.params.id,
      { order },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Deposit order updated successfully',
      data: deposit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update deposit order',
      error: error.message
    });
  }
};

export {
  getAllDeposits,
  getActiveDeposits,
  getDeposit,
  createDeposit,
  updateDeposit,
  deleteDeposit,
  updateDepositOrder
};
