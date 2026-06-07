import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../config/theme";

const C = COLORS;
const SEP = 1;

const img  = { flex: 1 } as const;
const vSep = { width: SEP,  backgroundColor: C.bg } as const;
const hSep = { height: SEP, backgroundColor: C.bg } as const;

export function PhotoMosaic({ photos }: { photos: string[] }) {
  if (!photos.length) {
    return <Ionicons name="images-outline" size={22} color={C.textMuted} />;
  }
  if (photos.length === 1) {
    return (
      <Image
        source={{ uri: photos[0] }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
    );
  }
  if (photos.length === 2) {
    return (
      <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]}>
        <Image source={{ uri: photos[0] }} style={img} contentFit="cover" />
        <View style={vSep} />
        <Image source={{ uri: photos[1] }} style={img} contentFit="cover" />
      </View>
    );
  }
  if (photos.length === 3) {
    return (
      <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]}>
        <Image source={{ uri: photos[0] }} style={img} contentFit="cover" />
        <View style={vSep} />
        <View style={{ flex: 1 }}>
          <Image source={{ uri: photos[1] }} style={img} contentFit="cover" />
          <View style={hSep} />
          <Image source={{ uri: photos[2] }} style={img} contentFit="cover" />
        </View>
      </View>
    );
  }
  // 4 photos — 2×2 grid
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <Image source={{ uri: photos[0] }} style={img} contentFit="cover" />
        <View style={vSep} />
        <Image source={{ uri: photos[1] }} style={img} contentFit="cover" />
      </View>
      <View style={hSep} />
      <View style={{ flex: 1, flexDirection: "row" }}>
        <Image source={{ uri: photos[2] }} style={img} contentFit="cover" />
        <View style={vSep} />
        <Image source={{ uri: photos[3] }} style={img} contentFit="cover" />
      </View>
    </View>
  );
}
