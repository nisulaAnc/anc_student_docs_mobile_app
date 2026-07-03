import React, { useRef } from 'react';
import { View, TextInput, StyleSheet, Text, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function OTPInput({ value = '', onChange, error, length = 6 }) {
  const { colors: COLORS } = useTheme();
  const refs = useRef([]);
  const digits = Array(length).fill('');
  for (let i = 0; i < value.length && i < length; i++) {
    digits[i] = value[i];
  }

  const handleChange = (text, i) => {
    const clean = text.replace(/\D/g, '');

    // Handle paste
    if (clean.length > 1) {
      const pastedArr = clean.slice(0, length).split('');
      const newDigits = [...digits];
      for (let j = 0; j < pastedArr.length; j++) {
        if (i + j < length) newDigits[i + j] = pastedArr[j];
      }
      onChange(newDigits.join(''));
      const nextFocus = Math.min(i + pastedArr.length, length - 1);
      refs.current[nextFocus]?.focus();
      return;
    }

    // Handle single digit typing
    const singleClean = clean.slice(-1);
    const arr = [...digits];
    arr[i] = singleClean;
    onChange(arr.join(''));
    if (singleClean && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyPress = ({ nativeEvent }, i) => {
    if (nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
      const arr = digits.slice();
      arr[i - 1] = '';
      onChange(arr.join(''));
      refs.current[i - 1]?.focus();
    }
  };

  return (
    <View>
      <View style={styles.row}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => { refs.current[i] = r; }}
            style={[
              styles.box,
              {
                borderColor: error ? COLORS.red : d ? COLORS.accent : COLORS.border,
                backgroundColor: d ? COLORS.accent + '15' : COLORS.bg,
                color: COLORS.navy,
              },
            ]}
            value={d}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            selectTextOnFocus
          />
        ))}
      </View>
      {error ? <Text style={[styles.errText, { color: COLORS.red }]}>{error}</Text> : null}
    </View>
  );
}

const { width } = Dimensions.get('window');
const GAP_SIZE = 8;
const SIDE_PADDING = 40; 
const MAX_BOX_WIDTH = 46; 

// Calculate dynamic box size: (screenWidth - padding - gaps) / 6
const boxWidth = Math.min(MAX_BOX_WIDTH, Math.floor((width - SIDE_PADDING - (GAP_SIZE * 5)) / 6));
const boxHeight = boxWidth * 1.25; 
const fontSize = Math.floor(boxWidth * 0.55); 

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: GAP_SIZE,
    marginVertical: 20,
  },
  box: {
    width: boxWidth,
    height: boxHeight,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: fontSize,
    fontWeight: '800',
  },
  errText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
});
