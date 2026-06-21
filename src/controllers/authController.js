const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET || 'yoursecretkey';

const normalizeAddress = (address = {}) => ({
  name: typeof address.name === 'string' ? address.name.trim() : '',
  phone: typeof address.phone === 'string' ? address.phone.trim() : '',
  street: typeof address.street === 'string' ? address.street.trim() : '',
  city: typeof address.city === 'string' ? address.city.trim() : '',
  province: typeof address.province === 'string' ? address.province.trim() : '',
  country: typeof address.country === 'string' && address.country.trim() ? address.country.trim() : 'Sri Lanka',
  zipCode: typeof address.zipCode === 'string' ? address.zipCode.trim() : '',
  isDefault: address.isDefault === true,
});

const validateAddress = (address) => {
  const requiredFields = ['name', 'phone', 'street', 'city', 'province', 'country', 'zipCode'];
  const missingField = requiredFields.find((field) => !address[field]);
  if (missingField) {
    return `${missingField} is required`;
  }

  return null;
};

const ensureOneDefaultAddress = (user) => {
  if (!user.addresses.length) {
    return;
  }

  const defaultIndex = user.addresses.findIndex((address) => address.isDefault);
  user.addresses.forEach((address, index) => {
    address.isDefault = defaultIndex === -1 ? index === 0 : index === defaultIndex;
  });
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '14d' }); // 2 weeks
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Signup failed', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '14d' }); // 2 weeks
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

exports.googleAuth = async (req, res) => {
  const { credential } = req.body;
  const client = new OAuth2Client(GOOGLE_CLIENT_ID);

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name } = payload;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ name, email, password: Math.random().toString(36), role: 'user' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '14d' }); // 2 weeks
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err); // Add this for debugging
    res.status(401).json({ message: 'Google authentication failed', error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile', error: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const { name, mobile } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (typeof name === 'string' && name.trim()) {
      user.name = name.trim();
    }

    if (typeof mobile === 'string') {
      user.mobile = mobile.trim();
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mobile: user.mobile,
        addresses: user.addresses,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = normalizeAddress(req.body);
    const validationError = validateAddress(address);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const shouldBeDefault = address.isDefault || user.addresses.length === 0;
    if (shouldBeDefault) {
      user.addresses.forEach((existingAddress) => {
        existingAddress.isDefault = false;
      });
    }

    user.addresses.push({
      ...address,
      isDefault: shouldBeDefault,
    });

    ensureOneDefaultAddress(user);
    await user.save();

    res.status(201).json({
      message: 'Address added successfully',
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add address', error: err.message });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = user.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const nextAddress = normalizeAddress({ ...address.toObject(), ...req.body });
    const validationError = validateAddress(nextAddress);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    if (nextAddress.isDefault) {
      user.addresses.forEach((existingAddress) => {
        existingAddress.isDefault = false;
      });
    }

    address.set(nextAddress);
    ensureOneDefaultAddress(user);
    await user.save();

    res.json({
      message: 'Address updated successfully',
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update address', error: err.message });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = user.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    user.addresses.forEach((existingAddress) => {
      existingAddress.isDefault = String(existingAddress._id) === String(address._id);
    });

    await user.save();

    res.json({
      message: 'Default address updated successfully',
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to set default address', error: err.message });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = user.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const wasDefault = address.isDefault;
    address.deleteOne();

    if (wasDefault) {
      ensureOneDefaultAddress(user);
    }

    await user.save();

    res.json({
      message: 'Address deleted successfully',
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete address', error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update password', error: err.message });
  }
};

exports.deleteMe = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete account', error: err.message });
  }
};
