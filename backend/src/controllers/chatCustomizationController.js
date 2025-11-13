import ChatCustomization from "../models/ChatCustomization.js";

// Lấy hoặc tạo customization cho một chat
export const getOrCreateCustomization = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;
    const isGroup = req.query.isGroup === "true";

    if (!chatId) {
      return res.status(400).json({ message: "Thiếu chatId" });
    }

    let customization = await ChatCustomization.findOne({
      userId,
      chatId,
      isGroup: isGroup || false,
    });

    if (!customization) {
      // Tạo mới nếu chưa có
      customization = await ChatCustomization.create({
        userId,
        chatId,
        isGroup: isGroup || false,
        quickReaction: "👍", // Mặc định
      });
    }

    res.status(200).json(customization);
  } catch (error) {
    console.error("❌ Lỗi lấy customization:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Cập nhật customization
export const updateCustomization = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;
    const { nickname, theme, quickReaction, isGroup } = req.body;

    console.log("📝 updateCustomization called:", { userId, chatId, nickname, theme, quickReaction, isGroup, isGroupType: typeof isGroup });

    if (!chatId) {
      return res.status(400).json({ message: "Thiếu chatId" });
    }

    // Xử lý quickReaction trước (nếu chỉ có quickReaction và không có theme/nickname)
    if (quickReaction !== undefined && theme === undefined && nickname === undefined) {
      const isGroupChat = isGroup === true || isGroup === "true";
      
      if (isGroupChat) {
        // Xử lý cho group chat
        const Group = (await import("../models/Group.js")).default;
        const group = await Group.findById(chatId).select("members");
        
        if (!group) {
          console.error("❌ Group not found:", chatId);
          return res.status(404).json({ message: "Nhóm không tồn tại" });
        }

        const isMember = group.members.some(
          (m) => String(m) === String(userId)
        );
        if (!isMember) {
          console.error("❌ User is not a member:", { userId, chatId });
          return res.status(403).json({ message: "Bạn không phải thành viên nhóm" });
        }

        let customization = await ChatCustomization.findOne({
          userId,
          chatId: chatId,
          isGroup: true,
        });

        if (!customization) {
          console.log("📝 Creating new customization for group");
          customization = await ChatCustomization.create({
            userId,
            chatId: chatId,
            isGroup: true,
            quickReaction: quickReaction || "👍",
          });
        } else {
          console.log("📝 Updating existing customization for group");
          customization.quickReaction = quickReaction || "👍";
          customization.isGroup = true;
          await customization.save();
        }

        // Emit socket event để tất cả thành viên nhận được thay đổi
        const io = req.app && req.app.get("io");
        if (io) {
          // Emit đến tất cả thành viên của nhóm
          group.members.forEach((memberId) => {
            try {
              io.to(String(memberId)).emit("chatCustomizationChanged", {
                chatId: chatId,
                type: "quickReaction",
                value: quickReaction || "👍",
                isGroup: true,
              });
            } catch (socketError) {
              console.warn(`⚠️ Không thể emit socket đến ${memberId}:`, socketError);
            }
          });
        }

        console.log("✅ Quick reaction updated successfully for group:", customization);
        return res.status(200).json({
          message: "Cập nhật cảm xúc nhanh thành công",
          customization,
        });
      } else {
        // Xử lý cho private chat
        let customization = await ChatCustomization.findOne({
          userId,
          chatId,
          isGroup: false,
        });

        if (!customization) {
          customization = await ChatCustomization.create({
            userId,
            chatId,
            isGroup: false,
            quickReaction: quickReaction || "👍",
          });
        } else {
          customization.quickReaction = quickReaction || "👍";
          customization.isGroup = false;
          await customization.save();
        }

        // Cập nhật quick reaction cho người bạn đang chat (để cả 2 bên cùng thấy)
        try {
          let friendCustomization = await ChatCustomization.findOne({
            userId: chatId,
            chatId: userId.toString(),
            isGroup: false,
          });

          if (!friendCustomization) {
            friendCustomization = await ChatCustomization.create({
              userId: chatId,
              chatId: userId.toString(),
              isGroup: false,
              quickReaction: quickReaction || "👍",
            });
          } else {
            friendCustomization.quickReaction = quickReaction || "👍";
            await friendCustomization.save();
          }

          // Emit socket event để cả hai bên cùng cập nhật
          const io = req.app && req.app.get("io");
          if (io) {
            // Emit đến user hiện tại
            io.to(userId.toString()).emit("chatCustomizationChanged", {
              chatId: chatId,
              type: "quickReaction",
              value: quickReaction || "👍",
              isGroup: false,
            });
            // Emit đến người bạn
            io.to(chatId.toString()).emit("chatCustomizationChanged", {
              chatId: userId.toString(),
              type: "quickReaction",
              value: quickReaction || "👍",
              isGroup: false,
            });
          }
        } catch (e) {
          console.warn("⚠️ Không thể đồng bộ quick reaction với bạn:", e);
          // Vẫn tiếp tục, không fail toàn bộ request
        }

        console.log("✅ Quick reaction updated successfully for private chat:", customization);
        return res.status(200).json({
          message: "Cập nhật cảm xúc nhanh thành công",
          customization,
        });
      }
    }

    // Normalize isGroup value
    const isGroupChat = isGroup === true || isGroup === "true";
    
    // Nếu là nhóm, cần xử lý khác
    if (isGroupChat) {
      // Với nhóm, theme được áp dụng cho tất cả thành viên
      if (theme !== undefined) {
        try {
          const Group = (await import("../models/Group.js")).default;
          const group = await Group.findById(chatId).select("members");
          
          if (!group) {
            return res.status(404).json({ message: "Nhóm không tồn tại" });
          }

          // Kiểm tra user có phải thành viên không
          const isMember = group.members.some(
            (m) => String(m) === String(userId)
          );
          if (!isMember) {
            return res.status(403).json({ message: "Bạn không phải thành viên nhóm" });
          }

          // Cập nhật theme cho tất cả thành viên
          const io = req.app && req.app.get("io");
          const updateErrors = [];
          
          for (const memberId of group.members) {
            try {
              let memberCustomization = await ChatCustomization.findOne({
                userId: memberId,
                chatId: chatId,
                isGroup: true,
              });

              if (!memberCustomization) {
                try {
                  memberCustomization = await ChatCustomization.create({
                    userId: memberId,
                    chatId: chatId,
                    isGroup: true,
                    theme: theme || null,
                    quickReaction: "👍",
                  });
                } catch (createError) {
                  // Nếu lỗi duplicate (có thể xảy ra do race condition), thử tìm lại
                  if (createError.code === 11000) {
                    memberCustomization = await ChatCustomization.findOne({
                      userId: memberId,
                      chatId: chatId,
                      isGroup: true,
                    });
                    if (memberCustomization) {
                      memberCustomization.theme = theme || null;
                      memberCustomization.isGroup = true;
                      await memberCustomization.save();
                    } else {
                      throw createError;
                    }
                  } else {
                    throw createError;
                  }
                }
              } else {
                memberCustomization.theme = theme || null;
                memberCustomization.isGroup = true;
                await memberCustomization.save();
              }

              // Emit socket event đến từng thành viên
              if (io) {
                try {
                  io.to(String(memberId)).emit("chatCustomizationChanged", {
                    chatId: chatId,
                    type: "theme",
                    value: theme || null,
                    isGroup: true,
                  });
                } catch (socketError) {
                  console.warn(`⚠️ Không thể emit socket đến ${memberId}:`, socketError);
                }
              }
            } catch (memberError) {
              console.warn(`⚠️ Lỗi cập nhật theme cho member ${memberId}:`, memberError);
              updateErrors.push(String(memberId));
              // Tiếp tục với các member khác
            }
          }

          // Lấy customization của user hiện tại để trả về
          let userCustomization = await ChatCustomization.findOne({
            userId,
            chatId,
            isGroup: true,
          });

          // Nếu user customization chưa tồn tại, tạo mới
          if (!userCustomization) {
            try {
              userCustomization = await ChatCustomization.create({
                userId,
                chatId,
                isGroup: true,
                theme: theme || null,
                quickReaction: "👍",
              });
            } catch (createError) {
              // Nếu lỗi duplicate (có thể xảy ra do race condition), thử tìm lại
              if (createError.code === 11000) {
                userCustomization = await ChatCustomization.findOne({
                  userId,
                  chatId,
                  isGroup: true,
                });
                if (!userCustomization) {
                  throw createError;
                }
              } else {
                throw createError;
              }
            }
          }

          // Nếu có lỗi với một số member nhưng đã cập nhật được cho user hiện tại, vẫn trả về success
          if (updateErrors.length > 0 && updateErrors.length < group.members.length) {
            console.warn(`⚠️ Cập nhật theme cho ${group.members.length - updateErrors.length}/${group.members.length} thành viên thành công`);
          }

          return res.status(200).json({
            message: "Cập nhật theme nhóm thành công",
            customization: userCustomization,
          });
        } catch (groupThemeError) {
          console.error("❌ Lỗi cập nhật theme nhóm:", groupThemeError);
          return res.status(500).json({ message: "Lỗi hệ thống khi cập nhật theme nhóm" });
        }
      }

      // Nếu là đổi tên nhóm (nickname trong context nhóm)
      if (nickname !== undefined) {
        const Group = (await import("../models/Group.js")).default;
        const group = await Group.findById(chatId);
        
        if (!group) {
          return res.status(404).json({ message: "Nhóm không tồn tại" });
        }

        // Kiểm tra user có phải thành viên nhóm không
        const isMember = group.members.some(
          (m) => String(m) === String(userId)
        );
        if (!isMember) {
          return res.status(403).json({ message: "Bạn không phải thành viên nhóm" });
        }

        group.name = nickname.trim();
        await group.save();

        // Emit event để refresh
        const io = req.app && req.app.get("io");
        if (io) {
          group.members.forEach((memberId) => {
            io.to(String(memberId)).emit("groupUpdated", group);
          });
        }

        return res.status(200).json({
          message: "Đổi tên nhóm thành công",
          group,
        });
      }

      // Xử lý quickReaction cho group chat (mỗi user có quick reaction riêng)
      if (quickReaction !== undefined) {
        try {
          const Group = (await import("../models/Group.js")).default;
          const group = await Group.findById(chatId).select("members");
          
          if (!group) {
            console.error("❌ Group not found:", chatId);
            return res.status(404).json({ message: "Nhóm không tồn tại" });
          }

          // Kiểm tra user có phải thành viên không
          const isMember = group.members.some(
            (m) => String(m) === String(userId)
          );
          if (!isMember) {
            console.error("❌ User is not a member:", { userId, chatId });
            return res.status(403).json({ message: "Bạn không phải thành viên nhóm" });
          }

          // Tìm hoặc tạo customization cho user này trong group
          let customization = await ChatCustomization.findOne({
            userId,
            chatId: chatId,
            isGroup: true,
          });

          if (!customization) {
            console.log("📝 Creating new customization for group");
            customization = await ChatCustomization.create({
              userId,
              chatId: chatId,
              isGroup: true,
              quickReaction: quickReaction || "👍",
            });
          } else {
            console.log("📝 Updating existing customization for group");
            customization.quickReaction = quickReaction || "👍";
            customization.isGroup = true;
            await customization.save();
          }

          console.log("✅ Quick reaction updated successfully:", customization);
          return res.status(200).json({
            message: "Cập nhật cảm xúc nhanh thành công",
            customization,
          });
        } catch (groupError) {
          console.error("❌ Error in quickReaction group handling:", groupError);
          throw groupError;
        }
      }
      
      // Nếu là group nhưng không có field nào được gửi lên, trả về lỗi
      console.warn("⚠️ Group update request but no valid fields provided");
      return res.status(400).json({ message: "Không có thông tin để cập nhật" });
    }

    // Logic cho chat cá nhân (giữ nguyên)
    // Nếu chỉ có quickReaction và không phải group, xử lý riêng
    // Kiểm tra isGroup: nếu là false, "false", undefined, hoặc null thì coi là private chat
    const isPrivateChat = !isGroupChat;
    
    if (quickReaction !== undefined && isPrivateChat && theme === undefined && nickname === undefined) {
      let customization = await ChatCustomization.findOne({
        userId,
        chatId,
        isGroup: false,
      });

      if (!customization) {
        customization = await ChatCustomization.create({
          userId,
          chatId,
          isGroup: false,
          quickReaction: quickReaction || "👍",
        });
      } else {
        customization.quickReaction = quickReaction || "👍";
        customization.isGroup = false;
        await customization.save();
      }

      return res.status(200).json({
        message: "Cập nhật cảm xúc nhanh thành công",
        customization,
      });
    }

    // Xử lý theme cho private chat
    if (theme !== undefined && isPrivateChat) {
      try {
        let customization = await ChatCustomization.findOne({
          userId,
          chatId,
          isGroup: false,
        });

        if (!customization) {
          customization = await ChatCustomization.create({
            userId,
            chatId,
            isGroup: false,
            nickname: nickname || null,
            theme: theme || null,
            quickReaction: quickReaction || "👍",
          });
        } else {
          // Cập nhật các trường được gửi lên
          if (nickname !== undefined) {
            customization.nickname = nickname || null;
          }
          customization.theme = theme || null;
          if (quickReaction !== undefined) {
            customization.quickReaction = quickReaction || "👍";
          }
          await customization.save();
        }

        // Cập nhật theme cho người bạn đang chat (để cả 2 bên cùng thấy theme)
        try {
          // Tìm customization của người bạn (chatId là userId của bạn, userId là chatId)
          let friendCustomization = await ChatCustomization.findOne({
            userId: chatId,
            chatId: userId.toString(),
            isGroup: false,
          });

          if (!friendCustomization) {
            friendCustomization = await ChatCustomization.create({
              userId: chatId,
              chatId: userId.toString(),
              isGroup: false,
              theme: theme || null,
              quickReaction: "👍", // Mặc định
            });
          } else {
            friendCustomization.theme = theme || null;
            await friendCustomization.save();
          }

          // Emit socket event để cả hai bên cùng cập nhật
          const io = req.app && req.app.get("io");
          if (io) {
            // Emit đến user hiện tại
            io.to(userId.toString()).emit("chatCustomizationChanged", {
              chatId: chatId,
              type: "theme",
              value: theme || null,
              isGroup: false,
            });
            // Emit đến người bạn
            io.to(chatId.toString()).emit("chatCustomizationChanged", {
              chatId: userId.toString(),
              type: "theme",
              value: theme || null,
              isGroup: false,
            });
          }
        } catch (e) {
          console.warn("⚠️ Không thể đồng bộ theme với bạn:", e);
          // Vẫn tiếp tục, không fail toàn bộ request
        }

        return res.status(200).json({
          message: "Cập nhật theme thành công",
          customization,
        });
      } catch (themeError) {
        console.error("❌ Lỗi cập nhật theme cho private chat:", themeError);
        return res.status(500).json({ message: "Lỗi hệ thống khi cập nhật theme" });
      }
    }

    // Xử lý nickname cho private chat (nếu không có theme)
    if (nickname !== undefined && isPrivateChat) {
      let customization = await ChatCustomization.findOne({
        userId,
        chatId,
        isGroup: false,
      });

      if (!customization) {
        customization = await ChatCustomization.create({
          userId,
          chatId,
          isGroup: false,
          nickname: nickname || null,
          quickReaction: quickReaction || "👍",
        });
      } else {
        customization.nickname = nickname || null;
        if (quickReaction !== undefined) {
          customization.quickReaction = quickReaction || "👍";
        }
        await customization.save();
      }

      // Cập nhật nickname cho người bạn đang chat (để cả 2 bên cùng thấy)
      try {
        let friendCustomization = await ChatCustomization.findOne({
          userId: chatId,
          chatId: userId.toString(),
          isGroup: false,
        });

        if (!friendCustomization) {
          friendCustomization = await ChatCustomization.create({
            userId: chatId,
            chatId: userId.toString(),
            isGroup: false,
            nickname: nickname || null,
            quickReaction: "👍",
          });
        } else {
          friendCustomization.nickname = nickname || null;
          await friendCustomization.save();
        }

        // Emit socket event để cả hai bên cùng cập nhật
        const io = req.app && req.app.get("io");
        if (io) {
          // Emit đến user hiện tại
          io.to(userId.toString()).emit("chatCustomizationChanged", {
            chatId: chatId,
            type: "nickname",
            value: nickname || null,
            isGroup: false,
          });
          // Emit đến người bạn
          io.to(chatId.toString()).emit("chatCustomizationChanged", {
            chatId: userId.toString(),
            type: "nickname",
            value: nickname || null,
            isGroup: false,
          });
        }
      } catch (e) {
        console.warn("⚠️ Không thể đồng bộ nickname với bạn:", e);
        // Vẫn tiếp tục, không fail toàn bộ request
      }

      return res.status(200).json({
        message: "Cập nhật customization thành công",
        customization,
      });
    }

    // Nếu không có field nào được xử lý, trả về lỗi
    return res.status(400).json({ message: "Không có thông tin để cập nhật" });
  } catch (error) {
    console.error("❌ Lỗi cập nhật customization:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Xóa customization (để reset về mặc định)
export const deleteCustomization = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;

    if (!chatId) {
      return res.status(400).json({ message: "Thiếu chatId" });
    }

    await ChatCustomization.findOneAndDelete({
      userId,
      chatId,
    });

    res.status(200).json({ message: "Đã xóa customization" });
  } catch (error) {
    console.error("❌ Lỗi xóa customization:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Lấy tất cả customizations của user
export const getAllCustomizations = async (req, res) => {
  try {
    const userId = req.user._id;

    const customizations = await ChatCustomization.find({
      userId,
    });

    res.status(200).json(customizations);
  } catch (error) {
    console.error("❌ Lỗi lấy customizations:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

